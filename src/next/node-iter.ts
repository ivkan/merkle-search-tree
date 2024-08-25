import { Page } from './page';
import { Node } from './node';

export enum VisitState
{
  Unvisited,
  Descended,
}

export interface PageVisit<N extends number, K>
{
  page: Page<N, K>;
  idx: number;
  state: VisitState;
}

export class NodeIter<N extends number, K> implements IterableIterator<Node<N, K>>
{
  private stack: PageVisit<N, K>[];

  constructor(p: Page<N, K>)
  {
    this.stack = [{
      page : p,
      idx  : 0,
      state: VisitState.Unvisited,
    }];
  }

  [Symbol.iterator](): IterableIterator<Node<N, K>>
  {
    return this;
  }

  next(): IteratorResult<Node<N, K>>
  {
    while (true)
    {
      const p = this.stack.pop();
      if (!p) return { done: true, value: undefined };

      const n = p.page.nodes[p.idx];
      if (!n)
      {
        const h = p.page.highPage;
        if (h)
        {
          this.stack.push({
            page : h,
            idx  : 0,
            state: VisitState.Unvisited,
          });
        }
        continue;
      }

      switch (p.state)
      {
        case VisitState.Unvisited:
        {
          const lt = n.ltPointer;
          if (lt)
          {
            this.stack.push({
              ...p,
              state: VisitState.Descended,
            });
            this.stack.push({
              state: VisitState.Unvisited,
              idx  : 0,
              page : lt,
            });
            continue;
          }
          break;
        }
        case VisitState.Descended:
          if (n.ltPointer === null)
          {
            throw new Error('Assertion failed: n.ltPointer() should not be null');
          }
          break;
      }

      this.stack.push({
        state: VisitState.Unvisited,
        idx  : p.idx + 1,
        page : p.page,
      });

      return { done: false, value: n };
    }
  }
}
