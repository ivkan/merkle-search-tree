import { Node } from '../node';
import { Page } from '../page';

/**
 * An observer of `Page` and the `Node` instances within them during tree
 * traversal.
 */
export interface Visitor<N extends number, K>
{
  /**
   * Called before a call to `visit_node()` with the same `Node`.
   *
   * By default this is a no-op unless implemented.
   */
  preVisitNode?(node: Node<N, K>): boolean;

  /**
   * Visit the given `Node`.
   */
  visitNode(node: Node<N, K>): boolean;

  /**
   * Called after `visit_node()` with the same `Node`.
   *
   * By default this is a no-op unless implemented.
   */
  postVisitNode?(node: Node<N, K>): boolean;

  /**
   * Visit the given `Page`, which was referenced via a high-page link if
   * `highPage` is true.
   *
   * By default this is a no-op unless implemented.
   */
  visitPage?(page: Page<N, K>, highPage: boolean): boolean;

  /**
   * Called after `visit_page()` with the same `Page`.
   *
   * By default this is a no-op unless implemented.
   */
  postVisitPage?(page: Page<N, K>): boolean;
}

// Default implementations for optional methods
export const defaultVisitor: Partial<Visitor<any, any>> = {
  preVisitNode : (node: Node<any, any>) => true,
  postVisitNode: (node: Node<any, any>) => true,
  visitPage    : (page: Page<any, any>, highPage: boolean) => true,
  postVisitPage: (page: Page<any, any>) => true,
}

