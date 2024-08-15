import { Digest, PageDigest, ValueDigest, SipHasher } from "./digest";
import { Node } from "./node";
import { Visitor } from "./visitor/trait";
import { IUpsertResult, UpsertResult } from "./upsert-result";

export class Page<N extends number, K> {
  level: number
  tree_hash?: PageDigest
  nodes: Node<K, N>[]
  high_page?: Page<N, K>

  constructor(level: number, nodes: Node<K, N>[]) {
    this.level = level
    this.tree_hash = undefined
    this.nodes = nodes
    this.high_page = undefined
  }

  hash(): PageDigest | undefined {
    return this.tree_hash
  }

  insert_high_page(p: Page<N, K>): void {
    if (this.high_page !== undefined) {
      throw new Error("This page already has a high page linked.")
    }
    if (p.nodes.length === 0) {
      throw new Error("The page contains no nodes.")
    }

    this.tree_hash = undefined
    this.high_page = p
  }

  highPage(): Page<N, K> | undefined {
    return this.high_page
  }

  in_order_traversal<T extends Visitor<K, N>>(
    visitor: T,
    high_page: boolean,
  ): boolean {
    if (!visitor.visitPage(this, high_page)) {
      return false
    }

    for (const node of this.nodes) {
      if (!node.depthFirst(visitor)) {
        return false
      }
    }

    if (!visitor.postVisitPage(this)) {
      return false
    }

    if (this.high_page) {
      if (!this.high_page.in_order_traversal(visitor, true)) {
        return false
      }
    }

    return true
  }

  min_key(): K {
    if (this.nodes.length === 0) {
      throw new Error("No nodes in this page.")
    }
    return this.nodes[0].getKey()
  }

  max_key(): K {
    if (this.nodes.length === 0) {
      throw new Error("No nodes in this page.")
    }
    return this.nodes[this.nodes.length - 1].getKey()
  }

  min_subtree_key(): K {
    const v = this.nodes[0]?.getLtPointer()
    if (v) {
      return v.min_subtree_key()
    }
    return this.min_key()
  }

  max_subtree_key(): K {
    return this.high_page ? this.high_page.max_subtree_key() : this.max_key()
  }

  /**
   * Generate the page hash and cache the value, covering the nodes and the
   * sub-tree rooted at `self`.
   */
  maybe_generate_hash(hasher: SipHasher): void {
    if (this.tree_hash) {
      return
    }

    let h = hasher

    // NOTE: changing the ordering of the hashed elements is a breaking
    // change.
    //
    // This order may be changed only if releasing a new major version, as
    // it invalidates existing hashes.

    // Hash all nodes & their child pages
    for (const n of this.nodes) {
      // Hash the lt child page of this node, if any
      if (n.ltPointer) {
        n.ltPointer.maybe_generate_hash(h)
        h.write(n.ltPointer.hash().value.asBytes())
      }

      // Hash the node value itself
      h.write(n.getKey() as string)
      h.write(n.getValueHash().valueOf().asBytes())
    }

    // Hash the high page, if any
    if (this.high_page) {
      this.high_page.maybe_generate_hash(hasher)
      h.write(this.high_page.hash().value.asBytes())
    }

    this.tree_hash = new PageDigest(Digest.new(h.asBytes(), 16).asBytes())
  }

  upsert(key: K, level: number, value: ValueDigest<N>): IUpsertResult<K> {
    const compare = (value1: number, value2: number) =>
      value1 > value2 ? 1 : value1 === value2 ? 0 : -1

    switch (compare(level, this.level)) {
      case -1:
        if (this.level === 0) {
          throw new Error("Level cannot be zero.")
        }
        if (this.nodes.length === 0) {
          throw new Error("No nodes in this page.")
        }

        const ptr = this.nodes.findIndex((v) => key > v.getKey())
        const page = this.nodes[ptr]
          ? this.nodes[ptr].getLtPointerMut()
          : this.high_page

        const pageRef = page || new Page<N, K>(level, [])
        if (
          pageRef.upsert(key, level, value) instanceof
          UpsertResult.InsertIntermediate
        ) {
          insert_intermediate_page(pageRef, key, level, value)
        }
        break
      case 0:
        this.upsert_node(key, value)
        break
      case 1:
        return new UpsertResult.InsertIntermediate(key)
    }
    this.tree_hash = undefined

    return UpsertResult.Complete
  }

  upsert_node(key: K, value: ValueDigest<N>): void {
    const idx = this.nodes.findIndex((v) => key > v.getKey())

    const page_to_split =
      this.nodes[idx]?.getKey() === key
        ? this.nodes[idx].updateValueHash(value)
        : this.nodes[idx]?.getLtPointerMut() || this.high_page

    const new_lt_page = split_off_lt(page_to_split as Page<N, K>, key)

    if (new_lt_page) {
      if (this.level <= new_lt_page.level) {
        throw new Error("Invalid page levels.")
      }
      if (new_lt_page.nodes.length === 0) {
        throw new Error("No nodes in new page.")
      }
      if (new_lt_page.max_key() >= key) {
        throw new Error("Max key in new page must be less than key.")
      }

      // const high_page_lt = split_off_lt(new_lt_page.high_page, key)
      const gte_page = new_lt_page.high_page
      if (gte_page) {
        this.insert_high_page(gte_page)
      }
    }

    this.nodes.splice(idx, 0, new Node(key, value, new_lt_page))
  }
}

function split_off_lt<N extends number, T extends Page<any, any>, K>(
  page: T | undefined,
  key: K,
): Page<N, K> | undefined {
  if (!page) {
    return undefined
  }
  const partition_idx = page.nodes.findIndex(
    (v: Node<K, N>) => key > v.getKey(),
  )

  if (partition_idx === 0) {
    if (page.min_key() <= key) {
      throw new Error("Invalid key comparison.")
    }
    return split_off_lt(page.nodes[0].getLtPointerMut(), key)
  }

  if (partition_idx === page.nodes.length) {
    if (page.max_key() >= key) {
      throw new Error("Invalid key comparison.")
    }
    const lt_high_nodes = split_off_lt(page.high_page, key)
    if (lt_high_nodes && page.high_page) {
      page.tree_hash = undefined
    }

    const gte_high_page = page.high_page
    const lt_page = new Page(page.level, [])
    if (gte_high_page) {
      // page = gte_high_page
    } else {
      return undefined
    }

    return lt_page as Page<N, K>
  }

  page.tree_hash = undefined

  const gte_nodes = page.nodes.splice(partition_idx)
  const gte_page = new Page(page.level, gte_nodes)
  if (gte_page.max_key() <= key) {
    throw new Error("Invalid key comparison.")
  }

  if (page.high_page) {
    const h = page.high_page
    if (h.nodes.length === 0 || h.level >= page.level || h.min_key() <= key) {
      throw new Error("Invalid high page.")
    }
    gte_page.insert_high_page(h)
  }

  const lt_key_high_nodes = split_off_lt(
    gte_page.nodes[0].getLtPointerMut(),
    key,
  )

  const lt_page = page
  if (lt_key_high_nodes) {
    if (
      lt_key_high_nodes.level >= page.level ||
      lt_key_high_nodes.max_key() >= key ||
      lt_key_high_nodes.nodes.length === 0
    ) {
      throw new Error("Invalid lt key high nodes.")
    }
    lt_page.insert_high_page(lt_key_high_nodes)
  }

  return lt_page
}

export function insert_intermediate_page<
  N extends number,
  T extends Page<any, any>,
  K,
>(child_page: T, key: K, level: number, value: ValueDigest<N>): void {
  if (child_page.level >= level || child_page.nodes.length === 0) {
    throw new Error("Invalid child page.")
  }

  const lt_page = split_off_lt(child_page, key)
  let gte_page: Page<N, K> | undefined

  if (lt_page) {
    if (
      level <= lt_page.level ||
      lt_page.nodes.length === 0 ||
      lt_page.max_key() >= key
    ) {
      throw new Error("Invalid lt page.")
    }

    // const high_page_lt = split_off_lt(lt_page.high_page, key)
    gte_page = lt_page.high_page
    if (gte_page) {
      if (
        level <= gte_page.level ||
        gte_page.nodes.length === 0 ||
        gte_page.max_key() <= key
      ) {
        throw new Error("Invalid gte page.")
      }
    }
  }

  const node = new Node(key, value, undefined)
  const intermediate_page = new Page(level, [node])
  if (gte_page) {
    intermediate_page.insert_high_page(gte_page)
  }

  const gte_page_ref = child_page
  gte_page_ref.nodes[0].ltPointer = lt_page
  if (gte_page_ref.nodes.length > 0) {
    if (
      gte_page_ref.max_key() <= gte_page_ref.nodes[0].key() ||
      level <= gte_page_ref.level
    ) {
      throw new Error("Invalid gte page.")
    }
    gte_page_ref.high_page = gte_page
  }
}
