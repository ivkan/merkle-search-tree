import { SipHasher24 } from 'siphash24';

interface Node<N, K>
{
  key(): K;

  value_hash(): ValueDigest<N>;

  lt_pointer(): Option<Page<N, K>>;

  lt_pointer_mut(): Option<Page<N, K>>;

  depth_first(visitor: Visitor<N, K>): boolean;

  update_value_hash(value: ValueDigest<N>): void;
}

interface ValueDigest<N>
{
  clone(): ValueDigest<N>;
}

interface PageDigest
{
  from(digest: Digest): PageDigest;
}

interface Digest
{
  new(bytes: Uint8Array): Digest;
}

interface Visitor<N, K>
{
  visit_page(page: Page<N, K>, high_page: boolean): boolean;

  post_visit_page(page: Page<N, K>): boolean;
}

// enum UpsertResult
//
// <K>{
//   Complete,
//   InsertIntermediate(key: K),
// }

class Page<N extends number, K>
{
  level: number;
  tree_hash: PageDigest|null;
  nodes: Node<N, K>[];
  high_page: Page<N, K>|null;

  constructor(level: number, nodes: Node<N, K>[])
  {
    this.level     = level;
    this.tree_hash = null;
    this.nodes     = nodes;
    this.high_page = null;
  }

  nodes(): Node<N, K>[]
  {
    return this.nodes;
  }

  level(): number
  {
    return this.level;
  }

  hash(): PageDigest|null
  {
    return this.tree_hash;
  }

  insert_high_page(p: Page<N, K>): void
  {
    if (this.high_page !== null || p.nodes.length === 0)
    {
      throw new Error('Panic: high page already linked or no nodes in the page');
    }
    this.tree_hash = null;
    this.high_page = p;
  }

  high_page(): Page<N, K>|null
  {
    return this.high_page;
  }

  in_order_traversal<T>(visitor: T, high_page: boolean): boolean
  {
    if (!visitor.visit_page(this, high_page))
    {
      return false;
    }

    for (const node of this.nodes)
    {
      if (!node.depth_first(visitor))
      {
        return false;
      }
    }

    if (!visitor.post_visit_page(this))
    {
      return false;
    }

    if (this.high_page !== null)
    {
      if (!this.high_page.in_order_traversal(visitor, true))
      {
        return false;
      }
    }

    return true;
  }

  min_key(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('Panic: no nodes in this page');
    }
    return this.nodes[0].key();
  }

  max_key(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('Panic: no nodes in this page');
    }
    return this.nodes[this.nodes.length - 1].key();
  }

  min_subtree_key(): K
  {
    const v = this.nodes[0].lt_pointer();
    if (v !== null)
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

  maybe_generate_hash(hasher: SipHasher24): void
  {
    if (this.tree_hash !== null)
    {
      return;
    }

    let h = hasher.clone();

    for (const n of this.nodes)
    {
      const child_hash = n.lt_pointer_mut()?.maybe_generate_hash(hasher)?.hash();
      if (child_hash !== null)
      {
        h.write(child_hash.as_ref());
      }

      h.write(n.key().as_ref());
      h.write(n.value_hash().as_ref());
    }

    if (this.high_page !== null)
    {
      const high_hash = this.high_page.maybe_generate_hash(hasher)?.hash();
      if (high_hash !== null)
      {
        h.write(high_hash.as_ref());
      }
    }

    this.tree_hash = PageDigest.from(Digest.new(h.finish128().as_bytes()));
  }

  upsert(key: K, level: number, value: ValueDigest<N>): UpsertResult<K>
  {
    if (level < this.level)
    {
      if (this.level === 0 || this.nodes.length === 0)
      {
        throw new Error('Panic: non-zero page can never be empty');
      }

      const ptr = this.nodes.findIndex(v => key > v.key());
      let page;
      if (ptr !== -1)
      {
        page = this.nodes[ptr].lt_pointer_mut();
      }
      else
      {
        page = this.high_page;
      }

      page = page ?? Box.new(Page.new(level, []));
      if (page.upsert(key, level, value.clone()) === UpsertResult.InsertIntermediate(key))
      {
        insert_intermediate_page(page, key, level, value);
      }
    }
    else if (level === this.level)
    {
      return this.upsert_node(key, value);
    }
    else
    {
      return UpsertResult.InsertIntermediate(key);
    }

    this.tree_hash = null;
    return UpsertResult.Complete;
  }

  upsert_node(key: K, value: ValueDigest<N>): void
  {
    const idx = this.nodes.findIndex(v => key > v.key());

    let page_to_split;
    if (idx !== -1 && this.nodes[idx].key() === key)
    {
      this.nodes[idx].update_value_hash(value);
      return;
    }
    else if (idx !== -1)
    {
      page_to_split = this.nodes[idx].lt_pointer_mut();
    }
    else
    {
      page_to_split = this.high_page;
    }

    let new_lt_page = split_off_lt(page_to_split, key)?.map(Box.new);

    if (new_lt_page !== null)
    {
      const lt_page      = new_lt_page;
      const high_page_lt = split_off_lt(lt_page.high_page, key);
      const gte_page     = lt_page.high_page;
      lt_page.high_page  = high_page_lt?.map(Box.new);
      if (gte_page !== null)
      {
        this.insert_high_page(gte_page);
      }
    }

    this.nodes.splice(idx, 0, Node.new(key, value, new_lt_page));
  }
}

function split_off_lt<N extends number, T, K>(page: T|null, key: K): Page<N, K>|null
{
  if (page === null)
  {
    return null;
  }

  const page_ref = page;
  if (page_ref.nodes.length === 0)
  {
    throw new Error('Panic: attempting to split a non-empty page');
  }

  const partition_idx = page_ref.nodes.findIndex(v => key > v.key());

  if (partition_idx === 0)
  {
    if (page_ref.min_key() > key)
    {
      const lt_page = split_off_lt(page_ref.nodes[0].lt_pointer_mut(), key);
      if (lt_page !== null)
      {
        page_ref.tree_hash = null;
        return lt_page;
      }
    }
    return null;
  }

  if (partition_idx === page_ref.nodes.length)
  {
    if (page_ref.max_key() < key)
    {
      const lt_high_nodes = split_off_lt(page_ref.high_page, key);
      if (lt_high_nodes !== null && page_ref.high_page !== null)
      {
        page_ref.tree_hash = null;
      }

      const gte_high_page = page_ref.high_page;
      page_ref.high_page  = lt_high_nodes?.map(Box.new);

      const lt_page = page_ref;
      page_ref      = Page.new(page_ref.level, []);

      if (gte_high_page !== null)
      {
        page_ref = gte_high_page;
      }
      else
      {
        page = null;
      }

      return lt_page;
    }
  }

  page_ref.tree_hash = null;

  const gte_nodes = page_ref.nodes.splice(partition_idx);
  const gte_page  = Page.new(page_ref.level, gte_nodes);

  if (page_ref.high_page !== null)
  {
    const h            = page_ref.high_page;
    page_ref.high_page = null;
    gte_page.insert_high_page(h);
  }

  const lt_key_high_nodes = split_off_lt(gte_page.nodes[0].lt_pointer_mut(), key);
  const lt_page           = page_ref;
  page_ref                = gte_page;

  if (lt_key_high_nodes !== null)
  {
    lt_page.insert_high_page(Box.new(lt_key_high_nodes));
  }

  return lt_page;
}

function insert_intermediate_page<N extends number, T, K>(
  child_page: T,
  key: K,
  level: number,
  value: ValueDigest<N>,
): void
{
  if (child_page.level() >= level || child_page.nodes.length === 0)
  {
    throw new Error('Panic: child page level is not less than the desired level or no nodes in the page');
  }

  let lt_page  = split_off_lt(child_page, key);
  let gte_page = null;

  if (lt_page !== null)
  {
    const high_page_lt = split_off_lt(lt_page.high_page, key);
    gte_page           = lt_page.high_page;
    lt_page.high_page  = high_page_lt?.map(Box.new);
  }

  const node              = Node.new(key, value, null);
  const intermediate_page = Page.new(level, [node]);

  if (gte_page !== null)
  {
    intermediate_page.insert_high_page(gte_page);
  }

  const gte_page = child_page;
  child_page     = intermediate_page;

  child_page.nodes[0].lt_pointer_mut() = lt_page?.map(Box.new);
  if (gte_page.nodes.length > 0)
  {
    child_page.high_page = Box.new(gte_page);
  }
}

