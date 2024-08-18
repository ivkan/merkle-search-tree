import { PageRange } from './page-range';
import { DiffListBuilder } from './diff-builder';
import { DiffRange } from './diff-range';

export function diff<K extends number>(local: PageRange<K>[], peer: PageRange<K>[]): DiffRange<K>[]
{
  const localIterator = local[Symbol.iterator]();
  const peerIterator  = peer[Symbol.iterator]();

  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = new Peekable<PageRange<K>>(localIterator);
  const peerPeekable  = new Peekable<PageRange<K>>(peerIterator);

  console.debug('calculating diff');

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
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
    console.debug('requesting unevaluated subtree page');
    diffBuilder.inconsistent(peer.peek().getStart(), peer.peek().getEnd());
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
      const end   = local.peek() ? Math.min(local.peek().getStart(), p.getEnd()) : p.getEnd();
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

function maybeAdvanceWithin<K extends number>(parent: PageRange<K>, cursor: Peekable<PageRange<K>>): PageRange<K>|null
{
  if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
  {
    return null;
  }
  return cursor.next();
}

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

