// import { Digest, PageDigest, ValueDigest } from './digest';
// import { Node } from './node';
//
//
// export class Page<K>
// {
//   level: number;
//   tree_hash: PageDigest|null;
//   nodes: Node<K>[];
//   high_page: Page<K>|null;
//
//   constructor(level: number, nodes: Node<K>[])
//   {
//     this.level     = level;
//     this.tree_hash = null;
//     this.nodes     = nodes;
//     this.high_page = null;
//   }
//
//   hash(): PageDigest|null
//   {
//     return this.tree_hash;
//   }
//
//   insert_high_page(p: Page<K>): void
//   {
//     if (this.high_page !== null || p.nodes.length === 0)
//     {
//       throw new Error('High page already exists or no nodes in the page');
//     }
//     this.tree_hash = null;
//     this.high_page = p;
//   }
//
//   in_order_traversal<T>(visitor: T, high_page: boolean): boolean
//   {
//     if (!visitor.visit_page(this, high_page))
//     {
//       return false;
//     }
//
//     for (const node of this.nodes)
//     {
//       if (!node.depth_first(visitor))
//       {
//         return false;
//       }
//     }
//
//     if (!visitor.post_visit_page(this))
//     {
//       return false;
//     }
//
//     if (this.high_page !== null && !this.high_page.in_order_traversal(visitor, true))
//     {
//       return false;
//     }
//
//     return true;
//   }
//
//   min_key(): K
//   {
//     if (this.nodes.length === 0)
//     {
//       throw new Error('No nodes in this page');
//     }
//     return this.nodes[0].getKey();
//   }
//
//   max_key(): K
//   {
//     if (this.nodes.length === 0)
//     {
//       throw new Error('No nodes in this page');
//     }
//     return this.nodes[this.nodes.length - 1].getKey();
//   }
//
//   min_subtree_key(): K
//   {
//     const v = this.nodes[0].getLtPointer();
//     if (v !== null)
//     {
//       return v.minSubtreeKey();
//     }
//     return this.min_key();
//   }
//
//   max_subtree_key(): K
//   {
//     if (this.high_page !== null)
//     {
//       return this.high_page.max_subtree_key();
//     }
//     return this.max_key();
//   }
//
//   maybe_generate_hash(hasher: SipHasher24): void
//   {
//     if (this.tree_hash !== null)
//     {
//       return;
//     }
//
//     const h = hasher.clone();
//
//     for (const n of this.nodes)
//     {
//       const child_hash = n.getLtPointer()?.maybe_generate_hash(hasher);
//       if (child_hash !== undefined)
//       {
//         h.write(child_hash.as_ref());
//       }
//
//       h.write(n.getKey());
//       h.write(n.getValueHash());
//     }
//
//     const high_hash = this.high_page?.maybe_generate_hash(hasher);
//     if (high_hash !== undefined)
//     {
//       h.write(high_hash.as_ref());
//     }
//
//     this.tree_hash = PageDigest.from(Digest.new(h.finish128().as_bytes()));
//   }
//
//   upsert(key: K, level: number, value: ValueDigest<N>): UpsertResult<K>
//   {
//     if (level < this.level)
//     {
//       const ptr      = this.nodes.findIndex(v => key > v.key());
//       const page     = ptr !== -1 ? this.nodes[ptr].lt_pointer() : this.high_page;
//       const page_ref = page !== null ? page : new Page(level, []);
//       if (page_ref.upsert(key, level, value) === UpsertResult.InsertIntermediate(key))
//       {
//         insert_intermediate_page(page_ref, key, level, value);
//       }
//     }
//     else if (level === this.level)
//     {
//       this.upsert_node(key, value);
//     }
//     else
//     {
//       return UpsertResult.InsertIntermediate(key);
//     }
//
//     this.tree_hash = null;
//     return UpsertResult.Complete;
//   }
//
//   upsert_node(key: K, value: ValueDigest<N>): void
//   {
//     const idx           = this.nodes.findIndex(v => key > v.key());
//     const page_to_split = idx !== -1 ? this.nodes[idx].lt_pointer() : this.high_page;
//
//     let new_lt_page = split_off_lt(page_to_split, key);
//
//     if (new_lt_page !== null)
//     {
//       const high_page_lt    = split_off_lt(new_lt_page.high_page, key);
//       const gte_page        = new_lt_page.high_page;
//       new_lt_page.high_page = high_page_lt !== null ? new Page(this.level, high_page_lt.nodes) : null;
//       if (gte_page !== null)
//       {
//         this.insert_high_page(gte_page);
//       }
//     }
//
//     this.nodes.splice(idx, 0, new Node(key, value, new_lt_page));
//   }
// }
//
// function split_off_lt<N extends number, T, K>(page: T|null, key: K): Page<N, K>|null
// {
//   if (page === null)
//   {
//     return null;
//   }
//
//   const partition_idx = page.nodes.findIndex(v => key > v.key());
//
//   if (partition_idx === 0)
//   {
//     return split_off_lt(page.nodes[0].lt_pointer(), key);
//   }
//
//   if (partition_idx === page.nodes.length)
//   {
//     const lt_high_nodes = split_off_lt(page.high_page, key);
//     const gte_high_page = page.high_page;
//     page.high_page      = lt_high_nodes !== null ? new Page(page.level, lt_high_nodes.nodes) : null;
//
//     const lt_page  = new Page(page.level, page.nodes);
//     page.nodes     = [];
//     page.high_page = gte_high_page;
//
//     return lt_page;
//   }
//
//   page.tree_hash  = null;
//   const gte_nodes = page.nodes.splice(partition_idx);
//   const gte_page  = new Page(page.level, gte_nodes);
//
//   if (page.high_page !== null)
//   {
//     gte_page.insert_high_page(page.high_page);
//     page.high_page = null;
//   }
//
//   const lt_key_high_nodes = split_off_lt(gte_page.nodes[0].lt_pointer(), key);
//   const lt_page           = new Page(page.level, page.nodes);
//   page.nodes              = gte_page.nodes;
//
//   if (lt_key_high_nodes !== null)
//   {
//     lt_page.insert_high_page(new Page(page.level, lt_key_high_nodes.nodes));
//   }
//
//   return lt_page;
// }
//
// function insert_intermediate_page<T, K>(
//   child_page: T,
//   key: K,
//   level: number,
//   value: ValueDigest,
// ): void
// {
//   let lt_page  = split_off_lt(child_page, key);
//   let gte_page = null;
//
//   if (lt_page !== null)
//   {
//     const high_page_lt = split_off_lt(lt_page.high_page, key);
//     gte_page           = lt_page.high_page;
//     lt_page.high_page  = high_page_lt !== null ? new Page(lt_page.level, high_page_lt.nodes) : null;
//   }
//
//   const node              = new Node(key, value, null);
//   const intermediate_page = new Page(level, [node]);
//
//   if (gte_page !== null)
//   {
//     intermediate_page.insert_high_page(gte_page);
//   }
//
//   const gte_page_ref             = child_page.nodes[0].lt_pointer();
//   child_page.nodes[0].lt_pointer = lt_page !== null ? new Page(lt_page.level, lt_page.nodes) : null;
//
//   if (gte_page_ref !== null && gte_page_ref.nodes.length > 0)
//   {
//     child_page.high_page = new Page(gte_page_ref.level, gte_page_ref.nodes);
//   }
// }
//
