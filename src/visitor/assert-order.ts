import { Visitor } from './Visitor';
import { Node, Page } from './types';

/**
 * An internal visitor used to assert ordering invariants during depth-first
 * tree traversal.
 *
 * Validates:
 *
 *   * Key traversal order (strictly increasing keys)
 *   * Page levels (decrease when traversing down, increasing up)
 *   * High pages are never empty
 */
export class InvariantAssertOrder<T extends Visitor<K>, K> implements Visitor<K> {
  private inner: T;
  private last: K | null;
  private levelStack: number[];

  constructor(inner: T) {
    this.inner = inner;
    this.last = null;
    this.levelStack = [];
  }

  /**
   * Unwrap this decorator, yielding the underlying `T`.
   */
  public intoInner(): T {
    return this.inner;
  }

  preVisitNode(node: Node<K>): boolean {
    return this.inner.preVisitNode(node);
  }

  visitNode(node: Node<K>): boolean {
    if (this.last !== null) {
      if (!(this.last < node.key())) {
        throw new Error(`visited key ${this.last} before key ${node.key()}`);
      }
    }

    this.last = node.key();

    return this.inner.visitNode(node);
  }

  postVisitNode(node: Node<K>): boolean {
    return this.inner.postVisitNode(node);
  }

  visitPage(page: Page<K>, highPage: boolean): boolean {
    // Page levels always increase as the visitor travels up the tree (for a
    // depth first search)
    const lastLevel = this.levelStack[this.levelStack.length - 1];
    if (lastLevel !== undefined && !(lastLevel > page.level())) {
      throw new Error('Invalid page level order');
    }

    // High pages are never empty (but normal pages can be, because of the
    // root page).
    if (highPage && page.nodes().length === 0) {
      throw new Error('High page is empty');
    }

    this.levelStack.push(page.level());
    return this.inner.visitPage(page, highPage);
  }

  postVisitPage(page: Page<K>): boolean {
    this.levelStack.pop();
    return this.inner.postVisitPage(page);
  }
}

// Note: The test module is omitted as it depends on other parts of the codebase that are not provided.
// You would need to implement the corresponding test setup in TypeScript, including the MerkleSearchTree and related types.

