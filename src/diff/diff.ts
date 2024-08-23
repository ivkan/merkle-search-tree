import { PageRange } from './page-range';
import { DiffRange } from './diff-range';
import { DiffListBuilder } from './diff-builder';
import { HasherInput } from '../digest';


export function diff<T extends Iterable<PageRange<K>>, U extends Iterable<PageRange<K>>, K extends HasherInput>(
  local: T,
  peer: U
): DiffRange<K>[]
{
  const localIterator = local[Symbol.iterator]();
  const peerIterator  = peer[Symbol.iterator]();

  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = peekable(localIterator);
  const peerPeekable  = peekable(peerIterator);

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
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
    if (peer.current())
    {
      // Add all the un-evaluated peer sub-tree pages to the sync list.
      diffBuilder.inconsistent(peer.current().getStart(), peer.current().getEnd());
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
  let lastP: PageRange<K>|null = null;

  while (true)
  {
    const p = maybeAdvanceWithin(subtreeRoot, peer);
    if (!p) return;

    const l = maybeAdvanceWithin(p, local);
    if (!l)
    {
      const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
      const end   = local.peek()?.getStart() ?? p.getEnd();
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

    if (l.getHash().equals(p.getHash()))
    {
      diffBuilder.consistent(p.getStart(), p.getEnd());
      skipSubtree(p, peer);
    }
    else
    {
      diffBuilder.inconsistent(p.getStart(), p.getEnd());
    }

    recurseSubtree(p, peer, local, diffBuilder);
  }
}

function maybeAdvanceWithin<K>(parent: PageRange<K>, cursor: Peekable<PageRange<K>>): PageRange<K>|null
{
  if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
  {
    return null;
  }
  return cursor.next()?.value || null;
}

function skipSubtree<K>(subtreeRoot: PageRange<K>, iter: Peekable<PageRange<K>>): void
{
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
  }
}

function peekable<T>(iter: Iterator<T>): Peekable<T>
{
  let cache: T|null = null;
  return {
    next   : () =>
    {
      if (cache !== null)
      {
        const result = cache;
        cache        = null;
        return { value: result, done: false };
      }
      return iter.next();
    },
    peek   : () =>
    {
      if (cache === null)
      {
        const result = iter.next();
        if (!result.done)
        {
          cache = result.value;
        }
      }
      return cache;
    },
    nextIf : (predicate: (value: T) => boolean) =>
    {
      const next = iter.next();
      return !next.done && predicate(next.value);

    },
    current: () => cache,
  };
}

interface Peekable<T>
{
  next: () => IteratorResult<T>;
  peek: () => T|null;
  nextIf: (predicate: (value: T) => boolean) => boolean;
  current: () => T|null;
}

