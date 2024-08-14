// Tree difference calculation algorithm & associated types.

import { PageRange } from './page-range';
import { DiffListBuilder } from './diff-builder';

export interface DiffRange<K>
{
  start: K;
  end: K;
}

export function cloneDiffRange<K>(range: DiffRange<K>): DiffRange<K>
{
  return {
    start: range.start,
    end  : range.end,
  };
}

export function overlaps<K>(self: DiffRange<K>, p: DiffRange<K>): boolean
{
  return p.end >= self.start && p.start <= self.end;
}

export function start<K>(range: DiffRange<K>): K
{
  return range.start;
}

export function end<K>(range: DiffRange<K>): K
{
  return range.end;
}

export function diff<T, U, K>(local: T, peer: U): DiffRange<K>[]
{
  const localIter = local[Symbol.iterator]();
  const peerIter  = peer[Symbol.iterator]();

  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = new Peekable(localIter);
  const peerPeekable  = new Peekable(peerIter);

  const root = peerPeekable.peek();
  if (!root) return [];

  recurseDiff(root, peerPeekable, localPeekable, diffBuilder);

  return diffBuilder.intoDiffVec();
}

function recurseSubtree<p, a, T, U, K>(
  subtreeRoot: PageRange<K>,
  peer: Peekable<U>,
  local: Peekable<T>,
  diffBuilder: DiffListBuilder<K>
): boolean
{
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
    diffBuilder.inconsistent(peer.current.start, peer.current.end);
  }

  return true;
}

function recurseDiff<p, a, T, U, K>(
  subtreeRoot: PageRange<K>,
  peer: Peekable<U>,
  local: Peekable<T>,
  diffBuilder: DiffListBuilder<K>
): void
{
  let lastP: PageRange<K>|null = null;

  while (true)
  {
    const p = maybeAdvanceWithin(subtreeRoot, peer);
    if (!p) return;

    const l = maybeAdvanceWithin(p, local);
    if (!l)
    {
      const start = lastP ? lastP.end : subtreeRoot.start;
      const end   = local.peek()?.start ?? p.end;
      if (end >= start)
      {
        diffBuilder.inconsistent(start, end);
      }
      return;
    }

    lastP = p;

    while (local.nextIf(v => v.isSupersetOf(p)))
    {
    }

    if (l.hash === p.hash)
    {
      diffBuilder.consistent(p.start, p.end);
      skipSubtree(p, peer);
    }
    else
    {
      diffBuilder.inconsistent(p.start, p.end);
    }

    recurseSubtree(p, peer, local, diffBuilder);
  }
}

function maybeAdvanceWithin<a, p, K, T>(
  parent: PageRange<K>,
  cursor: Peekable<T>
): PageRange<K>|null
{
  if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
  {
    return null;
  }
  return cursor.next();
}

function skipSubtree<p, T, K>(subtreeRoot: PageRange<K>, iter: Peekable<T>): void
{
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
  }
}

