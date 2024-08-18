// import { PageRange } from './page-range';
// import { DiffListBuilder } from './diff-builder';
// import { DiffRange } from './diff-range';

/*export function diff<T, U, K>(local: Iterable<PageRange<K>>, peer: Iterable<PageRange<K>>): DiffRange<K>[]
{
  const localIterator = local[Symbol.iterator]();
  const peerIterator  = peer[Symbol.iterator]();

  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = new Peekable(localIterator);
  const peerPeekable  = new Peekable(peerIterator);

  console.debug('calculating diff');

  const root = peerPeekable.peek();
  if (!root) return [];

  recurseDiff(root, peerPeekable, localPeekable, diffBuilder);

  return diffBuilder.intoDiffVec();
}*/

/*export function diff<K>(
  local: Iterable<PageRange<K>>,
  peer: Iterable<PageRange<K>>
): DiffRange<K>[]
{
  const localIter = local[Symbol.iterator]() as IterableIterator<PageRange<K>>;
  const peerIter  = peer[Symbol.iterator]() as IterableIterator<PageRange<K>>;

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

  // console.debug('calculating diff');

  const root = peerIter.next().value;
  if (!root)
  {
    return [];
  }

  recurseDiff(root, peerIter, localIter, diffBuilder);

  return diffBuilder.intoDiffVec();
}

export function recurseSubtree<K>(
  subtreeRoot: PageRange<K>,
  peer: IterableIterator<PageRange<K>>,
  local: IterableIterator<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): boolean
{
  // Recurse into the subtree, which will exit immediately if the next value
  // in peer is not rooted at subtreeRoot (without consuming the iter value).
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  // Invariant - when returning from this call, the entire subtree rooted at
  // the peer_subtree_root should have been evaluated and the next peer page
  // (if any) escapes the subtree.

  let p: PageRange<K>|undefined;
  while ((p = peer.next().value) !== undefined && subtreeRoot.isSupersetOf(p))
  {
    console.debug(
      `requesting unevaluated subtree page: ${p}`
    );
    // Add all the un-evaluated peer sub-tree pages to the sync list.
    diffBuilder.inconsistent(p.getStart(), p.getEnd());
  }

  // console.assert(
  //   peer.peek() === undefined || !subtreeRoot.isSupersetOf(peer.peek()!)
  // );

  return true;
}

function recurseDiff<K>(
  subtreeRoot: PageRange<K>,
  peer: IterableIterator<PageRange<K>>,
  local: IterableIterator<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
)
{
  // The last visited peer page, if any.
  let lastP: PageRange<K>|undefined;

// Process this subtree, descending down inconsistent paths recursively, and
// iterating through the tree.
  while (true)
  {
    const p = maybeAdvanceWithin(subtreeRoot, peer);
    if (!p)
    {
      console.debug('no more peer pages in subtree');
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
      const localPeek = local.next().value;
      if (localPeek && localPeek.isSupersetOf(p))
      {
        console.debug(
          `local page is a superset of peer`,
          { peerPage: p, localPage: localPeek }
        );
        return;
      }

      // If there's no matching local page that overlaps with p, then
      // there must be be one or more keys to be synced from the peer
      // to populate the missing local pages.
      //
      // Request the range starting from the end of the last checked p
      // (lastP), or the start of the subtreeRoot if none.
      const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
      // And end at the next local page key, or the page end.
      //
      // Any pages missing between p.end and the end of this subtree
      // will be added by the caller (recurseSubtree).
      const end = localPeek ? Math.min(localPeek.start(), p.getEnd() as number) : p.getEnd();
      if (end >= start)
      {
        console.debug(
          `no more local pages in subtree - requesting missing page ranges`,
          { peerPage: p }
        );
        diffBuilder.inconsistent(start, end as K);
      }
      else
      {
        console.debug(
          `no more local pages in subtree`,
          { peerPage: p }
        );
      }

      return;
    }

    lastP = p;

    console.debug(
      `visit page`,
      { peerPage: p, localPage: l }
    );

    // Advance the local cursor to minimise the comparable range, in turn
    // minimising the sync range.
    while (local.next() && local.next()?.value!.isSupersetOf(p))
    {
      const v = local.next().value;
      console.debug(
        `shrink local diff range`,
        { peerPage: p, skipLocalPage: l, localPage: v }
      );
      l = v;
    }

    if (l.getHash() === p.getHash())
    {
      console.debug(
        `hash match - consistent page`,
        { peerPage: p, localPage: l }
      );

      // Record this page as fully consistent.
      diffBuilder.consistent(p.getStart(), p.getEnd());

      // Skip visiting the pages in the subtree rooted at the current
      // page: they're guaranteed to be consistent due to the consistent
      // parent hash.
      skipSubtree(p, peer);
    }
    else
    {
      console.debug(
        `hash mismatch`,
        { peerPage: p, localPage: l }
      );

      diffBuilder.inconsistent(p.getStart(), p.getEnd());
    }

    // Evaluate the sub-tree, causing all the (consistent) child ranges to
    // be added to the consistent list to, shrink this inconsistent range
    // (or simply advancing through the subtree if this page is consistent).
    recurseSubtree(p, peer, local, diffBuilder);
  }
}

// Return the next PageRange if it is part of the sub-tree rooted at parent.
function maybeAdvanceWithin<K>(
  parent: PageRange<K>,
  cursor: IterableIterator<PageRange<K>>
): PageRange<K> | undefined {
  if (cursor.next().value?.map((p: PageRange<K>) => !parent.isSupersetOf(p)).unwrapOr(false)) {
    return undefined;
  }

  return cursor.next()?.value;
}

/!**
 * Advance `iter` to the next page that does not form part of the subtree
 * rooted at the given `subtree_root`.
 *!/
/!*function skipSubtree<K>(
  subtreeRoot: PageRange<K>,
  iter: IterableIterator<PageRange<K>>
): void {
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)) !== undefined) {}
}*!/
function skipSubtree<K>(
  subtreeRoot: PageRange<K>,
  iter: Iterator<PageRange<K>>,
) {
  let nextPage = iter.next()
  while (!nextPage.done && subtreeRoot.isSupersetOf(nextPage.value)) {
    nextPage = iter.next()
  }
}*/


/*export function recurseSubtree<K>(
  subtreeRoot: PageRange<K>,
  peer: Peekable<PageRange<K>>,
  local: Peekable<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): boolean
{
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
    console.debug('requesting unevaluated subtree page');
    diffBuilder.inconsistent(peer.start(), peer.end());
  }

  return true;
}*/

/*export function recurseDiff<K>(
  subtreeRoot: PageRange<K>,
  peer: Peekable<PageRange<K>>,
  local: Peekable<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): void
{
  let lastP: PageRange<K>|null = null;

  while (true)
  {
    const p = maybeAdvanceWithin(subtreeRoot, peer);
    if (!p)
    {
      console.trace('no more peer pages in subtree');
      return;
    }

    const l = maybeAdvanceWithin(p, local);
    if (!l)
    {
      if (local.peek() && local.peek().isSupersetOf(p))
      {
        console.trace('local page is a superset of peer');
        return;
      }

      const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
      const end   = local.peek() ? Math.min(local.peek().start, p.getEnd() as number) : p.getEnd();
      if (end >= start)
      {
        console.debug('no more local pages in subtree - requesting missing page ranges');
        diffBuilder.inconsistent(start, end as K);
      }
      return;
    }

    lastP = p;

    console.trace('visit page');

    while (local.nextIf(v => v.isSupersetOf(p)))
    {
    }

    if (l.getHash() === p.getHash())
    {
      console.debug('hash match - consistent page');
      diffBuilder.consistent(p.getStart(), p.getEnd());
      skipSubtree(p, peer);
    }
    else
    {
      console.debug('hash mismatch');
      diffBuilder.inconsistent(p.getStart(), p.getEnd());
    }

    recurseSubtree(p, peer, local, diffBuilder);
  }
}

export function maybeAdvanceWithin<K>(parent: PageRange<K>, cursor: Peekable<PageRange<K>>): PageRange<K>|null
{
  if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
  {
    return null;
  }
  return cursor.next();
}

export function skipSubtree<K>(subtreeRoot: PageRange<K>, iter: Peekable<PageRange<K>>): void
{
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
  }
}*/

