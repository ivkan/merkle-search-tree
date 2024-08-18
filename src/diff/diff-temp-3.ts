// import { PageRange } from './page-range';
// import { DiffListBuilder } from './diff-builder';
// import { DiffRange } from './diff-range';
//
// export function cloneDiffRange<K>(range: DiffRange<K>): DiffRange<K>
// {
//   return new DiffRange(range.start, range.end);
// }
//
// export function start<K>(range: DiffRange<K>): K
// {
//   return range.start;
// }
//
// export function end<K>(range: DiffRange<K>): K
// {
//   return range.end;
// }
//
// export function diff<K extends number>(
//   local: Iterable<PageRange<K>>,
//   peer: Iterable<PageRange<K>>
// ): DiffRange<K>[]
// {
//   const localIter = Array.from(local);
//   const peerIter  = Array.from(peer);
//
//   const diffBuilder = new DiffListBuilder<K>();
//
//   let peerIndex  = 0;
//
//   if (peerIter.length === 0)
//   {
//     return [];
//   }
//
//   const root = peerIter[peerIndex];
//
//   recurseDiff(root, peerIter, localIter, diffBuilder);
//
//   return diffBuilder.intoDiffVec();
// }
//
// function recurseSubtree<K extends number>(
//   subtreeRoot: PageRange<K>,
//   peer: PageRange<K>[],
//   local: PageRange<K>[],
//   diffBuilder: DiffListBuilder<K>
// ): boolean
// {
//   recurseDiff(subtreeRoot, peer, local, diffBuilder);
//
//   while (peer.length > 0 && subtreeRoot.isSupersetOf(peer[0]))
//   {
//     const p = peer.shift();
//     if (p)
//     {
//       diffBuilder.inconsistent(p.getStart(), p.getEnd());
//     }
//   }
//
//   return true;
// }
//
// function recurseDiff<K extends number>(subtreeRoot: PageRange<K>, peer: PageRange<K>[], local: PageRange<K>[], diffBuilder: DiffListBuilder<K>): void
// {
//   let lastP: PageRange<K>|null = null;
//
//   while (true)
//   {
//     const p = maybeAdvanceWithin(subtreeRoot, peer);
//     if (!p)
//     {
//       return;
//     }
//
//     const l = maybeAdvanceWithin(p, local);
//     if (!l)
//     {
//       const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
//       const end   = local.length > 0 ? Math.min(local[0].getStart(), p.getEnd()) : p.getEnd();
//       if (end >= start)
//       {
//         diffBuilder.inconsistent(start, end as K);
//       }
//       return;
//     }
//
//     lastP = p;
//
//     while (local.length > 0 && local[0].isSupersetOf(p))
//     {
//       local.shift();
//     }
//
//     if (l.getHash() === p.getHash())
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
// function maybeAdvanceWithin<K extends number>(parent: PageRange<K>, cursor: PageRange<K>[]): PageRange<K>|null
// {
//   if (cursor.length === 0 || !parent.isSupersetOf(cursor[0]))
//   {
//     return null;
//   }
//   return cursor.shift() || null;
// }
//
// function skipSubtree<K extends number>(subtreeRoot: PageRange<K>, iter: PageRange<K>[]): void
// {
//   while (iter.length > 0 && subtreeRoot.isSupersetOf(iter[0]))
//   {
//     iter.shift();
//   }
// }
//
