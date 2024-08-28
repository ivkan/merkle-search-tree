import { PageRange } from './page-range';
import { DiffRange } from './diff-range';
import { DiffListBuilder } from './diff-builder';
import { debug, trace } from '../tracing';
import { HasherInput } from '../digest';
import { isNil } from '../utils/nil';
import { Peekable } from '../utils/pickable';

/**
 *  Compute the difference between 'local' and 'peer' and return the set of
 *  DiffRange covering the inconsistent key ranges found in 'peer'.
 *
 *  ```typescript
 *
 *  // Initialise a "peer" tree.
 *  const node_a = MerkleSearchTree.default();
 *  node_a.upsert("bananas", 42);
 *  node_a.upsert("platanos", 42);
 *
 *  // Initialise the "local" tree with differing keys
 *  const node_b = MerkleSearchTree.default();
 *  node_b.upsert("donkey", 42);
 *
 *  // Generate the tree hashes before serialising the page ranges
 *  node_a.rootHash();
 *  node_b.rootHash();
 *
 *  // Generate the tree page bounds & hashes, and feed into the diff function
 *  const diffRange = diff(
 *      node_b.serialisePageRanges(),
 *      node_a.serialisePageRanges(),
 *  );
 *
 *  // The diff_range contains all the inclusive key intervals the "local" tree
 *  // should fetch from the "peer" tree to converge.
 *  expect(diffRange.start).toEqual("bananas");
 *  expect(diffRange.end).toEqual("plátanos");
 *  ```
 *
 *  # State Convergence
 *
 *  To converge the state of the two trees, the key ranges in the returned DiffRange
 *  instances should be requested from the `peer` and used to update the state of the `local`.
 *
 *  If `local` contains all the keys and consistent values of `peer` or the two trees are identical,
 *  no DiffRange intervals are returned.
 */
export function diff<T extends Iterable<PageRange<K>>, U extends Iterable<PageRange<K>>, K extends HasherInput>(
  local: T,
  peer: U
): DiffRange<K>[]
{
  const localIterator = local[Symbol.iterator]();
  const peerIterator  = peer[Symbol.iterator]();

  // Any two Merkle trees can be represented as a series of overlapping page ranges.
  // These ranges can be consistent (hashes match) or inconsistent (hashes differ) in content.
  //
  // This algorithm creates two sets of intervals: one for key ranges that are fully
  // consistent between the two trees, and another for inconsistent ranges.
  //
  // The DiffListBuilder assists in creating these lists and merging them into a final,
  // non-overlapping, deduplicated, and minimized set of ranges that are inconsistent between
  // the trees as described above.
  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = new Peekable<PageRange<K>>(localIterator);
  const peerPeekable  = new Peekable<PageRange<K>>(peerIterator);

  debug('calculating diff');

  const root = peerPeekable.peek();
  if (!root) return [];

  recurseDiff(root, peerPeekable, localPeekable, diffBuilder);

  return diffBuilder.intoDiffVec();
}

function recurseSubtree<K extends HasherInput>(
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
      debug('requesting unevaluated subtree page', { peer_page: peer });
      // Add all the un-evaluated peer sub-tree pages to the sync list.
      diffBuilder.inconsistent(peer.peek()?.start, peer.peek()?.end);
    }
  }

  return true;
}

function recurseDiff<K extends HasherInput>(
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

    let l = maybeAdvanceWithin(p, local);
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
        trace('local page is a superset of peer', { peer_page: p, local_page: l });
        return;
      }

      // If there's no matching local page that overlaps with p, then
      // there must be be one or more keys to be synced from the peer
      // to populate the missing local pages.
      //
      // Request the range starting from the end of the last checked p
      // (lastP), or the start of the subtree_root if none.
      const start = lastP ? lastP.end : subtreeRoot.start;
      const end   = local.peek() ? Math.min(local.peek().start as number, p.end as number) : p.end;

      // And end at the next local page key, or the page end.
      //
      // Any pages missing between p.end and the end of this subtree
      // will be added by the caller (recurse_subtree).
      if (end >= start)
      {
        debug('no more local pages in subtree - requesting missing page ranges', { peer_page: p });
        diffBuilder.inconsistent(start, end as K);
      }
      else
      {
        trace('no more local pages in subtree', { peer_page: p });
      }
      return;
    }

    lastP = p;

    trace('visit page', { peer_page: p, local_page: l });

    // Advance the local cursor to minimise the comparable range, in turn
    // minimising the sync range.
    while (true)
    {
      const v = local.nextIf(value => value.isSupersetOf(p));
      if (isNil(v)) break;

      trace('shrink local diff range', { peer_page: p, skip_local_page: l, local_page: v });
      l = v;
    }

    if (l.hash.equals(p.hash))
    {
      debug('hash match - consistent page', { peer_page: p, local_page: l });

      // Record this page as fully consistent.
      diffBuilder.consistent(p.start, p.end);

      // Skip visiting the pages in the subtree rooted at the current
      // page: they're guaranteed to be consistent due to the consistent
      // parent hash.
      skipSubtree(p, peer);
    }
    else
    {
      debug('hash mismatch', { peer_page: p, local_page: l });
      diffBuilder.inconsistent(p.start, p.end);
    }

    // Evaluate the sub-tree, causing all the (consistent) child ranges to
    // be added to the consistent list to, shrink this inconsistent range
    // (or simply advancing through the subtree if this page is consistent).
    recurseSubtree(p, peer, local, diffBuilder);
  }
}

/**
 * Advance `iter` to the next page that does not form part of the subtree
 * rooted at the given `subtree_root`.
 */
function skipSubtree<K extends HasherInput>(subtreeRoot: PageRange<K>, iter: Peekable<PageRange<K>>): void
{
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
  }
}

/**
 * Return the next PageRange if it is part of the sub-tree rooted at
 * `parent`.
 */
function maybeAdvanceWithin<K extends HasherInput>(
  parent: PageRange<K>,
  cursor: Peekable<PageRange<K>>
): PageRange<K>|null
{
  if (cursor.peek() && parent.isSupersetOf(cursor.peek()))
  {
    return cursor.next();
  }
  return null;
}
