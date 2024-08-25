import { PageRange } from './page-range';
import { DiffListBuilder } from './diff-builder';
import { DiffRange } from './diff-range';

export function cloneDiffRange<K>(range: DiffRange<K>): DiffRange<K>
{
  return {
    start: range.start,
    end  : range.end,
  };
}

export function start<K>(range: DiffRange<K>): K
{
  return range.start;
}

export function end<K>(range: DiffRange<K>): K
{
  return range.end;
}

export function diff<T extends Iterable<PageRange<K>>, U extends Iterable<PageRange<K>>, K>(
  local: T,
  peer: U
): DiffRange<K>[]
{
  const localIterator = local[Symbol.iterator]();
  const peerIterator  = peer[Symbol.iterator]();

  const diffBuilder = new DiffListBuilder<K>();

  const root = peerIterator.next().value;
  if (!root) return [];

  recurseDiff(root, peerIterator, localIterator, diffBuilder);

  return diffBuilder.intoDiffVec();
}

function recurseSubtree<K>(
  subtreeRoot: PageRange<K>,
  peer: Iterator<PageRange<K>>,
  local: Iterator<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): boolean
{
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  let p;
  while ((p = peer.next().value) && subtreeRoot.isSupersetOf(p))
  {
    diffBuilder.inconsistent(p.start, p.end);
  }

  return true;
}

function recurseDiff<K>(
  subtreeRoot: PageRange<K>,
  peer: Iterator<PageRange<K>>,
  local: Iterator<PageRange<K>>,
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
      const end   = local.next().value ? local.next().value.start : p.end;
      if (end >= start)
      {
        diffBuilder.inconsistent(start, end);
      }
      return;
    }

    lastP = p;

    while (local.next().value && local.next().value.isSupersetOf(p))
    {
      // Skip local page
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

function maybeAdvanceWithin<K>(parent: PageRange<K>, cursor: Iterator<PageRange<K>>): PageRange<K>|null
{
  const next = cursor.next();
  if (next.done || !parent.isSupersetOf(next.value))
  {
    return null;
  }
  return next.value;
}

function skipSubtree<K>(subtreeRoot: PageRange<K>, iter: Iterator<PageRange<K>>): void
{
  while (iter.next().value && subtreeRoot.isSupersetOf(iter.next().value))
  {
  }
}

