import { Node } from './node';
import { PageDigest, ValueDigest } from './digest';
import { Visitor } from './visitor';
import { Hash } from 'crypto';
import { insertIntermediatePage, splitOffLt } from './page-utils';

export class InsertIntermediate<T>
{
  key: T

  constructor(key: T)
  {
    this.key = key
  }
}

type Complete = 'Complete'
export type IUpsertResult<T> = Complete|InsertIntermediate<T>
export const UpsertResult = {
  Complete          : 'Complete' as Complete,
  InsertIntermediate: (k: any) => new InsertIntermediate(k),
}

/**
 * A group of [`Node`] instances at the same location within the tree.
 *
 * A page within an MST is a probabilistically sized structure, with varying
 * numbers of [`Node`] within. A page has a min/max key range defined by the
 * nodes within it, and the page hash acts as a content hash, describing the
 * state of the page and the nodes within it.
 */
export class Page<N extends number, K>
{
  level: number;
  treeHash: PageDigest|null;
  nodes: Node<N, K>[];
  highPage: Page<N, K>|null;

  constructor(level: number, nodes: Node<N, K>[])
  {
    this.level    = level;
    this.treeHash = null;
    this.nodes    = nodes;
    this.highPage = null;
  }

  hash(): PageDigest|null
  {
    return this.treeHash;
  }

  insertHighPage(p: Page<N, K>): void
  {
    if (this.highPage !== null || p.nodes.length === 0)
    {
      throw new Error('Panic: high page already linked or empty nodes');
    }
    this.treeHash = null;
    this.highPage = p;
  }

  inOrderTraversal<T extends Visitor<N, K>>(visitor: T, high_page: boolean): boolean
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

    if (this.highPage !== null && !this.highPage.inOrderTraversal(visitor, true))
    {
      return false;
    }

    return true;
  }

  minKey(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('No nodes in this page.');
    }
    return this.nodes[0].getKey();
  }

  maxKey(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('No nodes in this page.');
    }
    return this.nodes[this.nodes.length - 1].getKey();
  }

  // maxKey(): K
  // {
  //   return this.nodes.length > 0
  //     ? this.nodes[this.nodes.length - 1].getKey()
  //     : this.highPage
  //       ? this.highPage.maxKey()
  //       : (null as unknown as K);
  // }

  minSubtreeKey(): K
  {
    const v = this.nodes[0]?.getLtPointer();
    if (v !== undefined)
    {
      return v.minSubtreeKey();
    }
    return this.minKey();
  }

  maxSubtreeKey(): K
  {
    if (this.highPage !== null)
    {
      return this.highPage.maxSubtreeKey();
    }
    return this.maxKey();
  }

  maybeGenerateHash(hasher: Hash): void
  {
    if (this.treeHash !== null)
    {
      return;
    }

    let h = hasher.copy();

    // Hash all nodes & their child pages
    for (const n of this.nodes)
    {
      // Hash the lt child page of this node, if any
      const ltPointer = n.getLtPointer();
      if (ltPointer !== null)
      {
        ltPointer.maybeGenerateHash(hasher);
        const childHash = ltPointer.hash();
        if (childHash !== null)
        {
          h.update(childHash.valueOf().asBytes());
        }
      }

      // Hash the node value itself
      h.update(n.getKey() as string);
      h.update(n.getValueHash().valueOf().asBytes());
    }

    // Hash the high page, if any
    if (this.highPage !== null)
    {
      this.highPage.maybeGenerateHash(hasher);
      const highHash = this.highPage.hash();
      if (highHash !== null)
      {
        h.update(highHash.valueOf().asBytes());
      }
    }

    this.treeHash = new PageDigest(h.digest());
  }

  upsert(key: K, level: number, value: ValueDigest<N>): IUpsertResult<K>
  {
    if (level < this.level)
    {
      if (this.level !== 0)
      {
        console.assert(this.nodes.length > 0);
      }

      const ptr = this.nodes.findIndex((v) => key <= v.getKey());
      let page: Page<N, K>|null;

      if (ptr !== -1)
      {
        console.assert(this.nodes[ptr].getKey() > key);
        page = this.nodes[ptr].getLtPointer();
      }
      else
      {
        page = this.highPage;
      }

      if (!page)
      {
        page = new Page<N, K>(level, []);
        if (ptr !== -1)
        {
          this.nodes[ptr].setLtPointer(page);
        }
        else
        {
          this.highPage = page;
        }
      }

      const result = page.upsert(key, level, value);
      if (result instanceof InsertIntermediate && result.key === key)
      {
        insertIntermediatePage(page, key, level, value);
      }
    }
    else if (level === this.level)
    {
      this.upsertNode(key, value);
    }
    else
    {
      return new InsertIntermediate(key);
    }

    this.treeHash = null;
    return UpsertResult.Complete;
  }

  upsertNode(key: K, value: ValueDigest<N>): void
  {
    const idx = this.nodes.findIndex((v) => key <= v.getKey());

    if (idx !== -1 && this.nodes[idx].getKey() === key)
    {
      this.nodes[idx].updateValueHash(value);
      return;
    }

    let pageToSplit = idx !== -1 ? this.nodes[idx].getLtPointer() : this.highPage;
    const newLtPage = splitOffLt(pageToSplit, key, updatedPage =>
    {
      pageToSplit = updatedPage;
    });

    if (newLtPage)
    {
      console.assert(this.level > newLtPage.level);
      console.assert(newLtPage.nodes.length > 0);
      console.assert(newLtPage.maxKey() < key);

      const highPageLt   = splitOffLt(newLtPage.highPage, key, updatedPage =>
      {
        newLtPage.highPage = updatedPage;
      });
      const gtePage      = newLtPage.highPage;
      newLtPage.highPage = highPageLt;

      if (gtePage)
      {
        console.assert(this.level > gtePage.level);
        console.assert(gtePage.nodes.length > 0);
        console.assert(gtePage.maxKey() > key);

        this.insertHighPage(gtePage);
      }
    }

    const newNode = new Node(key, value, newLtPage);
    this.nodes.splice(idx === -1 ? this.nodes.length : idx, 0, newNode);
  }

  /*upsert(key: K, level: number, value: ValueDigest<N>): IUpsertResult<K> {
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
          : this.highPage

        const pageRef = page || new Page<N, K>(level, [])
        if (
          pageRef.upsert(key, level, value) instanceof
          UpsertResult.InsertIntermediate
        ) {
          insertIntermediatePage(pageRef, key, level, value)
        }
        break
      case 0:
        this.upsertNode(key, value)
        break
      case 1:
        return new UpsertResult.InsertIntermediate(key)
    }
    this.treeHash = undefined

    return UpsertResult.Complete
  }

  upsertNode(key: K, value: ValueDigest<N>): void {
    const idx = this.nodes.findIndex((v) => key > v.getKey())

    let page_to_split =
            this.nodes[idx]?.getKey() === key
              ? this.nodes[idx].updateValueHash(value)
              : this.nodes[idx]?.getLtPointerMut() || this.highPage

    const new_lt_page = splitOffLt(page_to_split, key, updatedPage =>
    {
      page_to_split = updatedPage;
    });

    if (new_lt_page) {
      if (this.level <= new_lt_page.level) {
        throw new Error("Invalid page levels.")
      }
      if (new_lt_page.nodes.length === 0) {
        throw new Error("No nodes in new page.")
      }
      if (new_lt_page.maxKey() >= key) {
        throw new Error("Max key in new page must be less than key.")
      }

      // const high_page_lt = split_off_lt(new_lt_page.high_page, key)
      const gte_page = new_lt_page.highPage
      if (gte_page) {
        this.insertHighPage(gte_page)
      }
    }

    this.nodes.splice(idx, 0, new Node(key, value, new_lt_page))
  }*/


  /*upsert(key: K, level: number, value: ValueDigest<N>): IUpsertResult<K>
  {
    if (level < this.level)
    {
      const ptr      = this.nodes.findIndex(v => key > v.getKey());
      const page     = ptr !== -1 ? this.nodes[ptr].getLtPointer() : this.highPage;
      const page_ref = page ?? new Page(level, []);
      if (page_ref.upsert(key, level, value) === UpsertResult.InsertIntermediate(key))
      {
        insertIntermediatePage(page_ref, key, level, value);
      }
    }
    else if (level === this.level)
    {
      this.upsertNode(key, value);
    }
    else
    {
      return UpsertResult.InsertIntermediate(key);
    }

    this.treeHash = null;
    return UpsertResult.Complete;
  }*/

  /*upsertNode(key: K, value: ValueDigest<N>): void
  {
    const idx           = this.nodes.findIndex(v => key > v.getKey());
    let page_to_split = idx !== -1 ? this.nodes[idx].getLtPointer() : this.highPage;

    let new_lt_page = splitOffLt(page_to_split, key, updatedPage =>
    {
      page_to_split = updatedPage;
    });

    if (new_lt_page !== undefined)
    {
      const lt_page      = new_lt_page.value;
      const high_page_lt = splitOffLt(lt_page.high_page, key, updatedPage =>
      {
        lt_page.high_page = updatedPage;
      });
      const gte_page     = lt_page.high_page;
      lt_page.high_page  = high_page_lt?.map(Box.new);
      if (gte_page !== undefined)
      {
        this.insertHighPage(gte_page);
      }
    }

    this.nodes.splice(idx, 0, new Node(key, value, new_lt_page));
  }*/

  /*upsert(key: K, level: number, value: ValueDigest<N>): IUpsertResult<K>
  {
    if (level < this.level)
    {
      if (this.level !== 0)
      {
        console.assert(this.nodes.length > 0);
      }

      if (this.nodes.length === 0) {
        throw new Error("No nodes in this page.")
      }

      const ptr = this.nodes.findIndex((v) => key <= v.getKey());
      let page: Page<N, K>|null;

      if (ptr !== -1)
      {
        console.assert(this.nodes[ptr].getKey() > key);
        page = this.nodes[ptr].getLtPointer();
      }
      else
      {
        page = this.highPage;
      }

      if (!page)
      {
        page = new Page<N, K>(level, []);
        if (ptr !== -1)
        {
          this.nodes[ptr].setLtPointer(page);
        }
        else
        {
          this.highPage = page;
        }
      }

      const result = page.upsert(key, level, value);
      if (result instanceof InsertIntermediate && result.key === key)
      {
        insertIntermediatePage(page, key, level, value);
      }
    }
    else if (level === this.level)
    {
      this.upsertNode(key, value);
    }
    else
    {
      return UpsertResult.InsertIntermediate(key);
    }

    this.treeHash = null;
    return UpsertResult.Complete;
  }

  upsertNode(key: K, value: ValueDigest<N>): void
  {
    const idx = this.nodes.findIndex((v) => key <= v.getKey());

    if (idx !== -1 && this.nodes[idx].getKey() === key)
    {
      this.nodes[idx].updateValueHash(value);
      return;
    }

    let pageToSplit = idx !== -1 ? this.nodes[idx].getLtPointer() : this.highPage;
    const newLtPage   = splitOffLt(pageToSplit, key, updatedPage =>
    {
      pageToSplit = updatedPage
    });

    if (newLtPage)
    {
      console.assert(this.level > newLtPage.level);
      console.assert(newLtPage.nodes.length > 0);
      console.assert(newLtPage.maxKey() < key);

      const highPageLt   = splitOffLt(newLtPage.highPage, key, updatedPage =>
      {
        newLtPage.highPage = updatedPage;
      });
      const gtePage      = newLtPage.highPage;
      newLtPage.highPage = highPageLt;

      if (gtePage)
      {
        console.assert(this.level > gtePage.level);
        console.assert(gtePage.nodes.length > 0);
        console.assert(gtePage.maxKey() > key);

        this.insertHighPage(gtePage);
      }
    }

    const newNode = new Node(key, value, newLtPage);
    this.nodes.splice(idx !== -1 ? idx : this.nodes.length, 0, newNode);
  }*/
}

/*export function splitOffLt<T, K>(page: T|null, key: K): Page<K>|null
{
  if (page === null)
  {
    return null;
  }

  const page_ref      = page.deref_mut();
  const partition_idx = page_ref._nodes.findIndex((v: Node<K>) => key > v.getKey());

  if (partition_idx === 0)
  {
    return splitOffLt(page_ref._nodes[0].lt_pointer(), key);
  }

  if (partition_idx === page_ref._nodes.length)
  {
    const lt_high_nodes = splitOffLt(page_ref.high_page, key);
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
    gte_page.insertHighPage(page_ref.high_page);
    page_ref.high_page = null;
  }

  const lt_key_high_nodes = splitOffLt(gte_page.nodes[0].getLtPointer(), key);
  const lt_page           = page_ref;
  page_ref.nodes          = [];
  page_ref.high_page      = null;

  if (lt_key_high_nodes !== null)
  {
    lt_page.insert_high_page(Box.new(lt_key_high_nodes));
  }

  return lt_page;
}*/

/*/!**
 * Split `page`, mutating it such that it contains only nodes with keys ordered
 * strictly-less than `key`, returning a new `Page` containing the
 * greater-than-or-equal-to nodes.
 *
 * If splitting `page` would leave it with no nodes, it is set to `undefined`.
 *
 * NOTE: this only splits the page provided - it is up to the caller to split
 * any high pages as necessary.
 *
 * @throws Error if attempting to split a non-empty page (root pages are never split).
 *!/
export function splitOffLt<K>(page: Page<K> | undefined, key: K): Page<K> | undefined {
  if (!page) return undefined;

  if (page.nodes.length === 0) {
    throw new Error("Cannot split an empty page");
  }

  // A page should be split into two parts - one page containing the elements
  // less-than "key", and one containing parts greater-or-equal to "key".
  const partitionIdx = page.nodes.findIndex(v => key <= v.getKey());

  // All the nodes are greater-than-or-equal-to "key" - there's no less-than
  // nodes to return.
  if (partitionIdx === 0) {
    if (page.minKey() <= key) {
      throw new Error("Assertion failed: page.minKey() > key");
    }

    // The first gte node may have a lt_pointer with nodes that are lt key.
    const ltPage = splitOffLt(page.nodes[0].getLtPointer(), key);
    if (ltPage) {
      // Invalidate the page hash as the lt_page was split or the keys
      // moved, changing the content the hash covers.
      page.treeHash = undefined;
      return ltPage;
    }
    return undefined;
  }

  // All the nodes are less than key.
  if (partitionIdx === page.nodes.length) {
    if (page.maxKey() >= key) {
      throw new Error("Assertion failed: page.maxKey() < key");
    }

    // The page may have a high page, which may have nodes within the
    // (max(nodes.key), key) range
    const ltHighNodes = splitOffLt(page.highPage, key);

    // If existing the high page was split (both sides are non-empty) then
    // invalidate the page hash.
    if (ltHighNodes && page.highPage) {
      page.treeHash = undefined;
    }

    // Put the lt nodes back into the high page, taking the gte nodes from
    // the high page.
    const gteHighPage = page.highPage;
    page.highPage = ltHighNodes;

    // Initialise the page we're about to return.
    const ltPage = new Page(page.level, page.nodes);
    page.nodes = [];

    // Put the gte nodes into the input page, if any (page should contain
    // all gte nodes after this split).
    if (gteHighPage) {
      Object.assign(page, gteHighPage);
    } else {
      page = undefined;
      console.log('clear!!')
    }

    return ltPage;
  }

  // Invalidate the page hash as at least one node will be removed.
  page.treeHash = undefined;

  // Obtain the set of nodes that are greater-than-or-equal-to "key".
  const gteNodes = page.nodes.splice(partitionIdx);
  if (gteNodes.length === 0) {
    throw new Error("Assertion failed: !gteNodes.isEmpty()");
  }

  // Initialise a new page to hold the gte nodes.
  const gtePage = new Page(page.level, gteNodes);
  if (gtePage.maxKey() <= key) {
    console.log({
      key,
      maxKey: gtePage.maxKey()
    });
    // throw new Error("Assertion failed: gtePage.maxKey() > key");
  }

  // Move the input high page onto the new gte page (which continues to be gte
  // than the nodes taken from the input page).
  if (page.highPage) {
    if (page.highPage.nodes.length === 0) {
      throw new Error("Assertion failed: !h.nodes.isEmpty()");
    }
    if (page.highPage.level >= page.level) {
      throw new Error("Assertion failed: h.level < page.level");
    }
    if (page.highPage.minKey() <= key) {
      throw new Error("Assertion failed: h.minKey() > key");
    }
    gtePage.insertHighPage(page.highPage);
    page.highPage = undefined;
  }

  // The first gte node may contain a lt_pointer with keys lt key, recurse
  // into it.
  const ltKeyHighNodes = splitOffLt(gtePage.nodes[0].getLtPointer(), key);

  // Replace the input page with the gte nodes, taking the page containing the
  // lt nodes and returning them to the caller.
  const ltPage = page;
  Object.assign(page, gtePage);
  if (ltPage.nodes.length === 0) {
    throw new Error("Assertion failed: !ltPage.nodes.isEmpty()");
  }
  if (ltPage.maxKey() >= key) {
    throw new Error("Assertion failed: ltPage.maxKey() < key");
  }

  // Insert the high page, if any.
  if (ltKeyHighNodes) {
    if (ltKeyHighNodes.level >= page.level) {
      throw new Error("Assertion failed: h.level < page.level");
    }
    if (ltKeyHighNodes.maxKey() >= key) {
      throw new Error("Assertion failed: h.maxKey() < key");
    }
    if (ltKeyHighNodes.nodes.length === 0) {
      throw new Error("Assertion failed: !h.nodes.isEmpty()");
    }
    ltPage.insertHighPage(ltKeyHighNodes);
  }

  return ltPage;
}*/

/*export function splitOffLt<K>(page: Page<K>|undefined, key: K): Page<K>|undefined
{
  if (page === null)
  {
    return null;
  }

  const partition_idx = page.nodes.findIndex(v => key > v.getKey());

  if (partition_idx === 0)
  {
    return splitOffLt(page.nodes[0].getLtPointer(), key);
  }

  if (partition_idx === page.nodes.length)
  {
    const lt_high_nodes = splitOffLt(page.highPage, key);
    const gte_high_page = page.highPage;
    page.highPage      = lt_high_nodes !== null ? new Page(page.level, lt_high_nodes.nodes) : null;

    const lt_page  = new Page(page.level, page.nodes);
    page.nodes     = [];
    page.highPage = gte_high_page;

    return lt_page;
  }

  page.treeHash  = null;
  const gte_nodes = page.nodes.splice(partition_idx);
  const gte_page  = new Page(page.level, gte_nodes);

  if (page.highPage !== null)
  {
    gte_page.insertHighPage(page.highPage);
    page.highPage = null;
  }

  const lt_key_high_nodes = splitOffLt(gte_page.nodes[0].getLtPointer(), key);
  const lt_page           = new Page(page.level, page.nodes);
  page.nodes              = gte_page.nodes;

  if (lt_key_high_nodes !== null)
  {
    lt_page.insertHighPage(new Page(page.level, lt_key_high_nodes.nodes));
  }

  return lt_page;
}*/

/**
 * Split `page`, mutating it such that it contains only nodes with keys ordered
 * strictly-less than `key`, returning a new `Page` containing the
 * greater-than-or-equal-to nodes.
 *
 * If splitting `page` would leave it with no nodes, it is set to `undefined`.
 *
 * NOTE: this only splits the page provided - it is up to the caller to split
 * any high pages as necessary.
 *
 * @throws Error if attempting to split a non-empty page (root pages are never split).
 */
/*export function splitOffLt<K>(page: Page<K>|undefined, key: K): Page<K>|undefined
{
  if (!page) return undefined;
  console.assert(page.nodes.length > 0);

  // A page should be split into two parts - one page containing the elements
  // less-than "key", and one containing parts greater-or-equal to "key".
  const partitionIdx = page.nodes.findIndex(v => key <= v.getKey());

  // All the nodes are greater-than-or-equal-to "key" - there's no less-than
  // nodes to return.
  if (partitionIdx === 0)
  {
    console.assert(page.minKey() > key);

    // The first gte node may have a lt_pointer with nodes that are lt key.
    const ltPage = splitOffLt(page.nodes[0].getLtPointer(), key);
    if (ltPage)
    {
      // Invalidate the page hash as the lt_page was split or the keys
      // moved, changing the content the hash covers.
      page.treeHash = undefined;
    }
    return ltPage;
  }

  // All the nodes are less than key.
  //
  // As an optimisation, simply return the existing page as the new page
  // (retaining the pre-computed hash if possible) and invalidate the old
  // page.
  if (partitionIdx === page.nodes.length)
  {
    console.assert(page.maxKey() < key);

    // The page may have a high page, which may have nodes within the
    // (max(nodes.key), key) range
    const ltHighNodes = splitOffLt(page.highPage, key);

    // If existing the high page was split (both sides are non-empty) then
    // invalidate the page hash.
    //
    // This effectively invalidates the page range of the returned lt_page
    // as the cached hash covers the high page (which has now been split,
    // changing the content).
    if (ltHighNodes && page.highPage)
    {
      page.treeHash = undefined;
    }

    // Put the lt nodes back into the high page, taking the gte nodes from
    // the high page.
    //
    // This leaves the lt_high_nodes in the high page link of page.
    const gteHighPage = page.highPage;
    page.highPage     = ltHighNodes;

    // Initialise the page we're about to return.
    //
    // This puts an empty page into page, taking the new lt nodes in
    // page (potentially with the high page linked to lt_high_nodes)
    const ltPage = page;
    page         = new Page(page.level, []);

    // Put the gte nodes into the input page, if any (page should contain
    // all gte nodes after this split).
    if (gteHighPage)
    {
      page = gteHighPage;
    }
    else
    {
      page = undefined;
    }

    return ltPage;
  }

  // Invalidate the page hash as at least one node will be removed.
  page.treeHash = undefined;

  // Obtain the set of nodes that are greater-than-or-equal-to "key".
  const gteNodes = page.nodes.splice(partitionIdx);
  console.assert(gteNodes.length > 0);

  // page now contains the lt nodes, and a high page that may be non-empty
  // and gte than key.

  // Initialise a new page to hold the gte nodes.
  const gtePage = new Page(page.level, gteNodes);
  console.log({
    maxKey: gtePage.maxKey(),
    key
  })
  console.assert(gtePage.maxKey() > key);

  // Move the input high page onto the new gte page (which continues to be gte
  // than the nodes taken from the input page).
  if (page.highPage)
  {
    console.assert(page.highPage.nodes.length > 0);
    console.assert(page.highPage.level < page.level);
    console.assert(page.highPage.minKey() > key);
    gtePage.insertHighPage(page.highPage);
    page.highPage = undefined;
  }

  // The first gte node may contain a lt_pointer with keys lt key, recurse
  // into it.
  const ltKeyHighNodes = splitOffLt(gtePage.nodes[0].getLtPointer(), key);

  // In which case it is gte all node keys in the lt page (or it wouldn't have
  // been on the gte node).
  //
  // Add this to the new lt_page's high page next.

  // Replace the input page with the gte nodes, taking the page containing the
  // lt nodes and returning them to the caller.
  const ltPage = page;
  page         = gtePage;
  console.assert(ltPage.nodes.length > 0);
  console.assert(ltPage.maxKey() < key);

  // Insert the high page, if any.
  if (ltKeyHighNodes)
  {
    console.assert(ltKeyHighNodes.level < page.level);
    console.assert(ltKeyHighNodes.maxKey() < key);
    console.assert(ltKeyHighNodes.nodes.length > 0);
    ltPage.insertHighPage(ltKeyHighNodes);
  }

  return ltPage;
}*/


/*export function insertIntermediatePage<K>(
  childPage: Page<K>,
  key: K,
  level: number,
  value: ValueDigest
): void
{
  // Debug assertions
  console.assert(childPage.level < level);
  console.assert(childPage.nodes.length > 0);

  // Split the child page
  let ltPage: Page<K>|undefined = splitOffLt(childPage, key);

  let gtePage: Page<K>|undefined;
  if (ltPage)
  {
    console.assert(level > ltPage.level);
    console.assert(ltPage.nodes.length > 0);
    console.assert(ltPage.maxKey() < key);

    const highPageLt = splitOffLt(ltPage.highPage, key);
    gtePage          = ltPage.highPage;
    ltPage.highPage  = highPageLt;

    if (gtePage)
    {
      console.assert(level > gtePage.level);
      console.assert(gtePage.nodes.length > 0);
      console.assert(gtePage.maxKey() > key);
    }
  }

  // Create the new node
  const node = new Node(key, value);

  // Create the new intermediate page
  const intermediatePage = new Page(level, [node]);
  if (gtePage)
  {
    intermediatePage.insertHighPage(gtePage);
  }

  // Replace the page pointer
  const gtePage2 = childPage.deref();
  childPage.deref = () => intermediatePage;

  // Link the pages
  intermediatePage.nodes[0].setLtPointer(ltPage);
  if (gtePage2.nodes.length > 0)
  {
    console.assert(gtePage2.maxKey() > intermediatePage.nodes[0].getKey());
    console.assert(level > gtePage2.level);
    intermediatePage.highPage = gtePage2;
  }
}*/
