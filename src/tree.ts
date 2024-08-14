import { Node } from "./node"
import { NodeIter } from "./node-iter"
import { insert_intermediate_page, Page } from "./page"
import { SipHasher } from "./digest/siphash"
import { RootHash, ValueDigest } from "./digest/wrappers"
import { digest } from "./lib"
import { Visitor } from "./visitor/trait"
import { PageRangeHashVisitor } from "./visitor/page-range-hash"
import { PageRange } from "./diff/page-range"
import { UpsertResult } from "./upsert-result"

type DefaultHasher = SipHasher

export class MerkleSearchTree<K, V, H = DefaultHasher, N extends number = 16> {
  hasher: H
  treeHasher: SipHasher24
  root: Page<N, K>
  _rootHash: RootHash | null
  _valueType: V

  constructor(hasher?: H) {
    this.hasher = hasher || (new SipHasher() as H)
    this.treeHasher = new SipHasher24()
    this.root = new Page<N, K>(0, [])
    this._rootHash = null
    this._valueType = {} as V // Placeholder for type
  }

  static default<K, V>(): MerkleSearchTree<K, V> {
    return new MerkleSearchTree<K, V>()
  }

  rootHashCached(): RootHash | null {
    return this._rootHash
  }

  inOrderTraversal<T extends Visitor<K, N>>(visitor: T): void {
    this.root.in_order_traversal(visitor, false)
  }

  nodeIter(): NodeIter<N, K> {
    return new NodeIter<N, K>(this.root)
  }

  rootHash(): RootHash {
    this.root.maybe_generate_hash(this.treeHasher)
    this._rootHash = this.root.hash()?.clone() as RootHash

    // Debugging output can be added here if needed

    return this._rootHash!
  }

  serialisePageRanges(): PageRange<K>[] | null {
    if (!this.rootHashCached()) {
      return null
    }

    if (this.root.nodes.length === 0) {
      return []
    }

    const visitor = new PageRangeHashVisitor()
    this.root.in_order_traversal(visitor, false)
    return visitor.finalise()
  }

  upsert(key: K, value: V): void {
    const valueHash = new ValueDigest(this.hasher.hash(value))
    const level = digest.level(this.hasher.hash(key))

    this._rootHash = null

    const result = this.root.upsert(key, level, valueHash.clone())
    if (result instanceof UpsertResult.InsertIntermediate) {
      if (this.root.nodes.length === 0) {
        const node = new Node(key, valueHash, null)
        this.root = new Page<N, K>(level, [node])
        return
      }

      insert_intermediate_page(this.root, key, level, valueHash)
    }
  }
}
