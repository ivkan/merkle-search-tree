import { Visitor } from '../Visitor';
import { Node } from '../node/Node';
import { Page } from '../page/Page';

/**
 * A no-op {@link Visitor} implementation - it does nothing!
 */
export class NopVisitor<K> implements Visitor<K>
{
  postVisitNode(node: Node<K>): boolean
  {
    return true;
  }

  visitPage(page: Page<K>, highPage: boolean): boolean
  {
    return true;
  }

  postVisitPage(page: Page<K>): boolean
  {
    return true;
  }

  preVisitNode(node: Node<K>): boolean
  {
    return true;
  }

  visitNode(node: Node<K>): boolean
  {
    return true;
  }
}

