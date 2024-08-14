import { Visitor } from "./trait"

/**
 * Internal visitor used to count and assert the number of key/value pairs in a
 * tree during traversal.
 */
export class InvariantAssertCount<T extends Visitor<N, K>, N extends number, K>
  implements Visitor<N, K>
{
  private inner: T
  private count: number

  /**
   * Wrap `T` in this decorator.
   */
  constructor(inner: T) {
    this.inner = inner
    this.count = 0
  }

  /**
   * Remove this decorator, asserting it has observed exactly `expect` number
   * of key/value pairs.
   *
   * @throws Error if `expect` does not match the observed key/value count.
   */
  unwrapCount(expect: number): T {
    const got = this.count
    if (got !== expect) {
      throw new Error(`got ${got}, want ${expect}`)
    }
    return this.inner
  }

  visitNode(node: Node<N, K>): boolean {
    this.count++
    return this.inner.visitNode(node)
  }

  preVisitNode(node: Node<N, K>): boolean {
    return this.inner.preVisitNode(node)
  }

  postVisitNode(node: Node<N, K>): boolean {
    return this.inner.postVisitNode(node)
  }

  visitPage(page: Page<N, K>, highPage: boolean): boolean {
    return this.inner.visitPage(page, highPage)
  }

  postVisitPage(page: Page<N, K>): boolean {
    return this.inner.postVisitPage(page)
  }
}

// Test module
import { MerkleSearchTree } from "./MerkleSearchTree"
import { NopVisitor } from "./NopVisitor"
import { Page } from "../page"

describe("InvariantAssertCount", () => {
  test("count", () => {
    const t = new MerkleSearchTree<string, string>()

    t.upsert("I", "bananas")
    t.upsert("K", "bananas")
    t.upsert("A", "bananas")
    t.upsert("E", "bananas")
    t.upsert("J", "bananas")
    t.upsert("B", "bananas")
    t.upsert("C", "bananas")
    t.upsert("D", "bananas")
    t.upsert("F", "bananas")
    t.upsert("G", "bananas")
    t.upsert("H", "bananas")

    const counter = new InvariantAssertCount(new NopVisitor())
    t.inOrderTraversal(counter)

    expect(() => counter.unwrapCount(11)).not.toThrow()
  })
})

export { InvariantAssertCount }
