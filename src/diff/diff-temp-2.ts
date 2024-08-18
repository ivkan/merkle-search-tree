/*import peekable, { Peekable } from 'it-peekable';
import { DiffListBuilder } from './diff-builder';
import { DiffRange } from './diff-range';
import { PageRange } from './page-range';

export function diff<T, U, K>(local: Iterable<PageRange<K>>, peer: Iterable<PageRange<K>>): DiffRange<K>[]
{
  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = peekable(local);
  const peerPeekable  = peekable(peer);

  console.debug('calculating diff');

  const root = peerPeekable.peek();
  if (!root) return [];

  recurseDiff(root, peerPeekable, localPeekable, diffBuilder);

  return diffBuilder.intoDiffVec();
}

export function recurseDiff<K>(
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

export function recurseSubtree<K>(
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
