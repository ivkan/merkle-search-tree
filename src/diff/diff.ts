import { PageRange } from './page-range';
import { DiffRange } from './diff-range';
import { DiffListBuilder } from './diff-builder';
import { Peekable } from '../next/diff/pickable';
import { debug, trace } from '../next/tracing';
import { HasherInput } from '../digest';


// export function diff<T extends Iterable<PageRange<K>>, U extends Iterable<PageRange<K>>, K extends HasherInput>(
//   local: T,
//   peer: U
// ): DiffRange<K>[]
// {
//   const localIterator = local[Symbol.iterator]();
//   const peerIterator  = peer[Symbol.iterator]();
//
//   const diffBuilder = new DiffListBuilder<K>();
//
//   const localPeekable = peekable(localIterator);
//   const peerPeekable  = peekable(peerIterator);
//
//   const root = peerPeekable.peek();
//   if (!root) return [];
//
//   recurseDiff(root, peerPeekable, localPeekable, diffBuilder);
//
//   return diffBuilder.intoDiffVec();
// }
//
// function recurseSubtree<K extends HasherInput>(
//   subtreeRoot: PageRange<K>,
//   peer: Peekable<PageRange<K>>,
//   local: Peekable<PageRange<K>>,
//   diffBuilder: DiffListBuilder<K>
// ): boolean
// {
//   recurseDiff(subtreeRoot, peer, local, diffBuilder);
//
//   while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
//   {
//     if (peer.current())
//     {
//       // Add all the un-evaluated peer sub-tree pages to the sync list.
//       diffBuilder.inconsistent(peer.current().getStart(), peer.current().getEnd());
//     }
//   }
//
//   return true;
// }
//
// function recurseDiff<K extends HasherInput>(
//   subtreeRoot: PageRange<K>,
//   peer: Peekable<PageRange<K>>,
//   local: Peekable<PageRange<K>>,
//   diffBuilder: DiffListBuilder<K>
// ): void
// {
//   let lastP: PageRange<K>|null = null;
//
//   while (true)
//   {
//     const p = maybeAdvanceWithin(subtreeRoot, peer);
//     if (!p) return;
//
//     const l = maybeAdvanceWithin(p, local);
//     if (!l)
//     {
//       const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
//       const end   = local.peek()?.getStart() ?? p.getEnd();
//       if (end >= start)
//       {
//         diffBuilder.inconsistent(start, end);
//       }
//       return;
//     }
//
//     lastP = p;
//
//     while (local.nextIf(v => v.isSupersetOf(p)))
//     {
//     }
//
//     if (l.getHash().equals(p.getHash()))
//     {
//       diffBuilder.consistent(p.getStart(), p.getEnd());
//       skipSubtree(p, peer);
//     }
//     else
//     {
//       diffBuilder.inconsistent(p.getStart(), p.getEnd());
//     }
//
//     recurseSubtree(p, peer, local, diffBuilder);
//   }
// }
//
// function maybeAdvanceWithin<K>(parent: PageRange<K>, cursor: Peekable<PageRange<K>>): PageRange<K>|null
// {
//   if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
//   {
//     return null;
//   }
//   return cursor.next()?.value || null;
// }
//
// function skipSubtree<K>(subtreeRoot: PageRange<K>, iter: Peekable<PageRange<K>>): void
// {
//   while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
//   {
//   }
// }
//
// function peekable<T>(iter: Iterator<T>): Peekable<T>
// {
//   let cache: T|null = null;
//   return {
//     next   : () =>
//     {
//       if (cache !== null)
//       {
//         const result = cache;
//         cache        = null;
//         return { value: result, done: false };
//       }
//       return iter.next();
//     },
//     peek   : () =>
//     {
//       if (cache === null)
//       {
//         const result = iter.next();
//         if (!result.done)
//         {
//           cache = result.value;
//         }
//       }
//       return cache;
//     },
//     nextIf : (predicate: (value: T) => boolean) =>
//     {
//       const next = iter.next();
//       return !next.done && predicate(next.value);
//
//     },
//     current: () => cache,
//   };
// }
//
// interface Peekable<T>
// {
//   next: () => IteratorResult<T>;
//   peek: () => T|null;
//   nextIf: (predicate: (value: T) => boolean) => boolean;
//   current: () => T|null;
// }

export function diff<T extends Iterable<PageRange<K>>, U extends Iterable<PageRange<K>>, K extends HasherInput>(
  local: T,
  peer: U
): DiffRange<K>[]
// export function diff<K extends number>(local: Iterable<PageRange<K>>, peer: Iterable<PageRange<K>>): DiffRange<K>[]
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
      debug('requesting unevaluated subtree page');
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
      const start = lastP ? lastP.end : subtreeRoot.start;
      const end   = local.peek() ? Math.min(local.peek().start as number, p.end as number) : p.end;

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

    if (l.hash.equals(p.hash))
    {
      debug('hash match - consistent page');
      diffBuilder.consistent(p.start, p.end);
      skipSubtree(p, peer);
    }
    else
    {
      debug('hash mismatch');
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

// export function extractPageRange(value: PageRange<any>)
// {
//   return {
//     start: value?.start,
//     end: value?.end,
//     hash: value?.hash?.value.asBytes()
//   }
// }

/**
 * Return the next [`PageRange`] if it is part of the sub-tree rooted at
 * `parent`.
 */
function maybeAdvanceWithin<K extends HasherInput>(
  parent: PageRange<K>,
  cursor: Peekable<PageRange<K>>
): PageRange<K>|null
{
  // console.log('x___x', {
  //   peek: extractPageRange(cursor.peek()),
  //   par: extractPageRange(parent)
  // });

  if (cursor.peek() && parent.isSupersetOf(cursor.peek()))
  {
    return cursor.next();
  }
  return null;
}
