import { List } from '../utils/list';
import { debug } from '../tracing';
import { DiffRange } from './diff-range';
import { DiffListBuilder } from './diff-builder';
import { PageRange } from './page-range';


export function diff<T extends ArrayLike<PageRange<K>>, U extends ArrayLike<PageRange<K>>, K extends number>(
  local: T,
  peer: U
): DiffRange<K>[]
{
  // const localIterator = local[Symbol.iterator]();
  // const peerIterator  = peer[Symbol.iterator]();

  // This algorithm builds two sets of intervals - one for key ranges that are
  // fully consistent between the two trees, and one for inconsistent ranges.
  const diffBuilder = new DiffListBuilder<K>();

  const localPeekable = new List<PageRange<K>>(local);
  const peerPeekable  = new List(peer);

  debug('calculating diff');

  const root = peerPeekable.peek();
  if (!root) return [];

  recurseDiff(root, peerPeekable, localPeekable, diffBuilder);

  return diffBuilder.intoDiffVec();
}

function recurseSubtree<K extends number>(
  subtreeRoot: PageRange<K>,
  peer: List<PageRange<K>>,
  local: List<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): boolean
{
  recurseDiff(subtreeRoot, peer, local, diffBuilder);

  while (peer.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
    debug('requesting unevaluated subtree page');
    // Add all the un-evaluated peer sub-tree pages to the sync list.
    diffBuilder.inconsistent(peer.peek().getStart(), peer.peek().getEnd());
  }

  return true;
}

function recurseDiff<K extends number>(
  subtreeRoot: PageRange<K>,
  peer: List<PageRange<K>>,
  local: List<PageRange<K>>,
  diffBuilder: DiffListBuilder<K>
): void
{
  let lastP: PageRange<K>|null = null;

  while (true)
  {
    const p = maybeAdvanceWithin(subtreeRoot, peer);
    if (!p)
    {
      debug('no more peer pages in subtree');
      return;
    }

    const l = maybeAdvanceWithin(p, local);
    if (!l)
    {
      if (local.peek() && local.peek().isSupersetOf(p))
      {
        debug('local page is a superset of peer');
        return;
      }

      const start = lastP ? lastP.getEnd() : subtreeRoot.getStart();
      const end   = local.peek()
        ? Math.min(local.peek().getStart(), p.getEnd()) as K
        : p.getEnd();
      if (end >= start)
      {
        debug('no more local pages in subtree - requesting missing page ranges');
        diffBuilder.inconsistent(start, end);
      }
      return;
    }

    lastP = p;

    debug('visit page');

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

    recurseSubtree(p, peer, local, diffBuilder);
  }
}

function maybeAdvanceWithin<K>(parent: PageRange<K>, cursor: List<PageRange<K>>): PageRange<K>|null
{
  if (cursor.peek() && !parent.isSupersetOf(cursor.peek()))
  {
    return null;
  }
  return cursor.next();
}

function skipSubtree<K>(subtreeRoot: PageRange<K>, iter: List<PageRange<K>>): void
{
  while (iter.nextIf(v => subtreeRoot.isSupersetOf(v)))
  {
  }
}

