import { Node } from './node';
import { PageDigest, ValueDigest } from './digest/wrappers';
import { Visitor } from './visitor/visitor';
import { Hash } from 'crypto';

// export class InsertIntermediate
// {
//   key: any;
//
//   constructor(key: any)
//   {
//     this.key = key;
//   }
// }
//
// export enum UpsertResult
// {
//   Complete           = 'Complete',
//   InsertIntermediate = InsertIntermediate,
// }

// namespace UpsertResult {
//   export class InsertIntermediate<K>
//   {
//     key: K;
//
//     constructor(key: K)
//     {
//       this.key = key;
//     }
//   }
// }

// export class UpsertResult<K>
// {
//   static Complete = 'Complete';
// }

export class Page<K>
{
  level: number;
  tree_hash: PageDigest|null;
  nodes: Node<K>[];
  high_page: Page<K>|null;

  constructor(level: number, nodes: Node<K>[])
  {
    this.level     = level;
    this.tree_hash = null;
    this.nodes     = nodes;
    this.high_page = null;
  }

  hash(): PageDigest|null
  {
    return this.tree_hash;
  }

  insert_high_page(p: Page<K>): void
  {
    if (this.high_page !== null || p.nodes.length === 0)
    {
      throw new Error('Panic: high page already linked or empty nodes');
    }
    this.tree_hash = null;
    this.high_page = p;
  }

  in_order_traversal<T extends Visitor<K>>(visitor: T, high_page: boolean): boolean
  {
    if (!visitor.visitPage(this, high_page))
    {
      return false;
    }

    for (const node of this.nodes)
    {
      if (!node.depthFirst(visitor))
      {
        return false;
      }
    }

    if (!visitor.postVisitPage(this))
    {
      return false;
    }

    if (this.high_page !== null && !this.high_page.in_order_traversal(visitor, true))
    {
      return false;
    }

    return true;
  }

  min_key(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('Panic: no nodes in this page');
    }
    return this.nodes[0].getKey();
  }

  max_key(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('Panic: no nodes in this page');
    }
    return this.nodes[this.nodes.length - 1].getKey();
  }

  min_subtree_key(): K
  {
    const v = this.nodes[0]?.getLtPointer();
    if (v !== undefined)
    {
      return v.min_subtree_key();
    }
    return this.min_key();
  }

  max_subtree_key(): K
  {
    if (this.high_page !== null)
    {
      return this.high_page.max_subtree_key();
    }
    return this.max_key();
  }

  maybe_generate_hash(hasher: Hash): void
  {
    if (this.tree_hash !== null)
    {
      return;
    }

    const h = hasher.copy();

    for (const n of this.nodes)
    {
      const child_hash = n.getLtPointer()?.maybe_generate_hash(hasher)?.hash();
      if (child_hash !== undefined)
      {
        h.write(child_hash.as_ref());
      }

      h.write(n.getKey());
      h.write(n.getValueHash());
    }

    const high_hash = this.high_page?.maybe_generate_hash(hasher)?.hash();
    if (high_hash !== undefined)
    {
      h.write(high_hash.as_ref());
    }

    this.tree_hash = PageDigest.new(h.digest());
  }

  upsert(key: K, level: number, value: ValueDigest): UpsertResult<K>
  {
    if (level < this.level)
    {
      const ptr      = this.nodes.findIndex(v => key > v.getKey());
      const page     = ptr !== -1 ? this.nodes[ptr].getLtPointer() : this.high_page;
      const page_ref = page ?? new Page(level, []);
      if (page_ref.upsert(key, level, value) === UpsertResult.InsertIntermediate(key))
      {
        insertIntermediatePage(page_ref, key, level, value);
      }
    }
    else if (level === this.level)
    {
      this.upsert_node(key, value);
    }
    else
    {
      return UpsertResult.InsertIntermediate(key);
    }

    this.tree_hash = null;
    return UpsertResult.Complete;
  }

  upsert_node(key: K, value: ValueDigest): void
  {
    const idx           = this.nodes.findIndex(v => key > v.getKey());
    const page_to_split = idx !== -1 ? this.nodes[idx].getLtPointer() : this.high_page;

    let new_lt_page = split_off_lt(page_to_split, key)?.map(Box.new);

    if (new_lt_page !== undefined)
    {
      const lt_page      = new_lt_page.value;
      const high_page_lt = split_off_lt(lt_page.high_page, key);
      const gte_page     = lt_page.high_page;
      lt_page.high_page  = high_page_lt?.map(Box.new);
      if (gte_page !== undefined)
      {
        this.insert_high_page(gte_page);
      }
    }

    this.nodes.splice(idx, 0, new Node(key, value, new_lt_page));
  }
}

export function split_off_lt<T, K>(page: T|null, key: K): Page<K>|null
{
  if (page === null)
  {
    return null;
  }

  const page_ref      = page.deref_mut();
  const partition_idx = page_ref._nodes.findIndex((v: Node<K>) => key > v.getKey());

  if (partition_idx === 0)
  {
    return split_off_lt(page_ref._nodes[0].lt_pointer(), key);
  }

  if (partition_idx === page_ref._nodes.length)
  {
    const lt_high_nodes = split_off_lt(page_ref.high_page, key);
    const gte_high_page = page_ref.high_page;
    page_ref.high_page  = lt_high_nodes?.map(Box.new);

    const lt_page      = new Page<K>(page_ref.level, page_ref.nodes);
    page_ref._nodes    = [];
    page_ref.high_page = gte_high_page;

    return lt_page;
  }

  page_ref.tree_hash = null;
  const gte_nodes    = page_ref.nodes.splice(partition_idx);
  const gte_page     = new Page<K>(page_ref.level, gte_nodes);

  if (page_ref.high_page !== null)
  {
    gte_page.insert_high_page(page_ref.high_page);
    page_ref.high_page = null;
  }

  const lt_key_high_nodes = split_off_lt(gte_page.nodes[0].getLtPointer(), key);
  const lt_page           = page_ref;
  page_ref.nodes          = [];
  page_ref.high_page      = null;

  if (lt_key_high_nodes !== null)
  {
    lt_page.insert_high_page(Box.new(lt_key_high_nodes));
  }

  return lt_page;
}

export function insertIntermediatePage<K>(
  child_page: Page<K>,
  key: K,
  level: number,
  value: ValueDigest,
): void
{
  const lt_page = split_off_lt(child_page, key);
  let gte_page  = null;

  if (lt_page !== null)
  {
    const high_page_lt = split_off_lt(lt_page.high_page, key);
    gte_page           = lt_page.high_page;
    lt_page.high_page  = high_page_lt?.map(Box.new);
  }

  const node              = new Node(key, value, null);
  const intermediate_page = new Page(level, [node]);

  if (gte_page !== null)
  {
    intermediate_page.insert_high_page(gte_page);
  }

  const gte_page_ref             = child_page.deref_mut();
  child_page.nodes[0].setLtPointer(
    lt_page?.map(Box.new)
  );

  if (gte_page_ref.nodes.length > 0)
  {
    child_page.high_page = Box.new(gte_page_ref);
  }
}

