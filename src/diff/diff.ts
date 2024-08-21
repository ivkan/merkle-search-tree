import { PageRange } from './page-range';
import { DiffListBuilder } from './diff-builder';
import { DiffRange } from './diff-range';
import { debug, trace } from '../tracing';

/**
 *  Compute the difference between `local` and `peer`, returning the set of
 *  [`DiffRange`] covering the inconsistent key ranges found in `peer`.
 *
 *  ```rust
 *  use merkle_search_tree::{MerkleSearchTree, diff::diff};
 *
 *  // Initialise a "peer" tree.
 *  let mut node_a = MerkleSearchTree.default();
 *  node_a.upsert("bananas", &42);
 *  node_a.upsert("plátanos", &42);
 *
 *  // Initialise the "local" tree with differing keys
 *  let mut node_b = MerkleSearchTree.default();
 *  node_b.upsert("donkey", &42);
 *
 *  // Generate the tree hashes before serialising the page ranges
 *  node_a.root_hash();
 *  node_b.root_hash();
 *
 *  // Generate the tree page bounds & hashes, and feed into the diff function
 *  let diff_range = diff(
 *      node_b.serialise_page_ranges().unwrap().into_iter(),
 *      node_a.serialise_page_ranges().unwrap().into_iter(),
 *  );
 *
 *  // The diff_range contains all the inclusive key intervals the "local" tree
 *  // should fetch from the "peer" tree to converge.
 *  assert_matches::assert_matches!(diff_range.as_slice(), [range] => {
 *      assert_eq!(range.start(), &"bananas");
 *      assert_eq!(range.end(), &"plátanos");
 *  });
 *  ```
 *
 *  # State Convergence
 *
 *  To converge the state of the two trees, the key ranges in the returned
 *  [`DiffRange`] instances should be requested from `peer` and used to update
 *  the state of `local`.
 *
 *  If `local` is a superset of `peer` (contains all the keys in `peer` and the
 *  values are consistent), or the two trees are identical, no [`DiffRange`]
 *  intervals are returned.
 *
 *  # Termination
 *
 *  A single invocation to [`diff()`] always terminates, and completes in `O(n)`
 *  time and space. Inconsistent page ranges (if any) are minimised in
 *  `O(n_consistent * n_inconsistent)` time and `O(n)` space.
 *
 *  In the absence of further external updates to either tree, this algorithm
 *  terminates (leaving `local` and `peer` fully converged) and no diff is
 *  returned within a finite number of sync rounds between the two trees.
 *
 *  If a one-way sync is performed (pulling inconsistent keys from `peer` and
 *  updating `local`, but never syncing the other way around) this algorithm MAY
 *  NOT terminate.
 */
export function diff<K extends number>(local: PageRange<K>[], peer: PageRange<K>[]): DiffRange<K>[]
{
  const localIterator = local[Symbol.iterator]();
  const peerIterator  = peer[Symbol.iterator]();

  // Any two merkle trees can be expressed as a series of overlapping page
  // ranges, either consistent in content (hashes match), or inconsistent
  // (hashes differ).
  //
  // This algorithm builds two sets of intervals - one for key ranges that are
  // fully consistent between the two trees, and one for inconsistent ranges.
  //
  // This DiffListBuilder helps construct these lists, and merges them into a
  // final, non-overlapping, deduplicated, and minimised set of ranges that
  // are inconsistent between trees as described above.
  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = new Peekable<PageRange<K>>(localIterator);
  const peerPeekable  = new Peekable<PageRange<K>>(peerIterator);

  debug('calculating diff');

  const root = peerPeekable.peek();
  if (!root) return [];

  recurseDiff(root, peerPeekable, localPeekable, diffBuilder);

  return diffBuilder.intoDiffVec();
}

function recurseSubtree<K extends number>(
  subtreeRoot: PageRange<K>,
  peer: Peekable<PageRange<K>>,
  local: Peekable<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): boolean
{
  // Recurse into the subtree, which will exit immediately if the next value
  // in peer is not rooted at subtree_root (without consuming the iter value).
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  // Invariant - when returning from this call, the entire subtree rooted at
  // the peer_subtree_root should have been evaluated and the next peer page
  // (if any) escapes the subtree.
  while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
    const range = peer.peek();
    if (range)
    {
      debug('requesting unevaluated subtree page');
      diffBuilder.inconsistent(peer.peek()?.getStart(), peer.peek()?.getEnd());
    }
  }

  return true;
}

function recurseDiff<K extends number>(
  subtreeRoot: PageRange<K>,
  peer: Peekable<PageRange<K>>,
  local: Peekable<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): void
{
  // The last visited peer page, if any.
  let lastP: PageRange<K>|null = null;

  while (true)
  {
    const p = maybeAdvanceWithin(subtreeRoot, peer);
    if (!p)
    {
      trace('no more peer pages in subtree');
      return;
    }

    const l = maybeAdvanceWithin(p, local);
    if (!l)
    {
      // If the local subtree range is a superset of the peer subtree
      // range, the two are guaranteed to be inconsistent due to the
      // local node containing more keys (potentially the sole cause
      // of that inconsistency).
      //
      // Fetching any pages from the less-up-to-date peer may be
      // spurious, causing no useful advancement of state.
      if (local.peek() && local.peek().isSupersetOf(p))
      {
        trace('local page is a superset of peer');
        return;
      }

      // If there's no matching local page that overlaps with p, then
      // there must be be one or more keys to be synced from the peer
      // to populate the missing local pages.
      //
      // Request the range starting from the end of the last checked p
      // (lastP), or the start of the subtree_root if none.
      const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
      const end   = local.peek() ? Math.min(local.peek().getStart(), p.getEnd()) : p.getEnd();

      // And end at the next local page key, or the page end.
      //
      // Any pages missing between p.end and the end of this subtree
      // will be added by the caller (recurse_subtree).
      if (end >= start)
      {
        debug('no more local pages in subtree - requesting missing page ranges');
        diffBuilder.inconsistent(start, end as K);
      }
      return;
    }

    lastP = p;

    trace('visit page');

    while (local.nextIf(v => v.isSupersetOf(p)))
    {
    }

    if (l.getHash() === p.getHash())
    {
      debug('hash match - consistent page');
      diffBuilder.consistent(p.getStart(), p.getEnd());
      skipSubtree(p, peer);
    }
    else
    {
      debug('hash mismatch');
      diffBuilder.inconsistent(p.getStart(), p.getEnd());
    }

    // Evaluate the sub-tree, causing all the (consistent) child ranges to
    // be added to the consistent list to, shrink this inconsistent range
    // (or simply advancing through the subtree if this page is consistent).
    recurseSubtree(p, peer, local, diffBuilder);
  }
}

function maybeAdvanceWithin<K extends number>(parent: PageRange<K>, cursor: Peekable<PageRange<K>>): PageRange<K>|null
{
  if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
  {
    return null;
  }
  return cursor.next();
}

/**
 * Advance `iter` to the next page that does not form part of the subtree
 * rooted at the given `subtree_root`.
 */
function skipSubtree<K extends number>(subtreeRoot: PageRange<K>, iter: Peekable<PageRange<K>>): void
{
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
  }
}

class Peekable<T>
{
  private iterator: Iterator<T>;
  private cache: T|null     = null;
  private hasCache: boolean = false;

  constructor(iterator: Iterator<T>)
  {
    this.iterator = iterator;
  }

  peek(): T|null
  {
    if (!this.hasCache)
    {
      this.cache    = this.iterator.next().value;
      this.hasCache = true;
    }
    return this.cache;
  }

  next(): T|null
  {
    if (this.hasCache)
    {
      this.hasCache = false;
      const value   = this.cache;
      this.cache    = null;
      return value;
    }
    return this.iterator.next().value;
  }

  nextIf(predicate: (value: T) => boolean): T|null
  {
    const value = this.next();
    if (value && predicate(value))
    {
      return value;
    }
    return null;
  }
}

