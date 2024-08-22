import { Node } from './node';
import { Hasher, PageDigest, ValueDigest } from './digest';
import { Visitor } from './visitor';
import { insertIntermediatePage, splitOffLt } from './page-utils';

export enum UpsertResult
{
  /** The key & value hash were successfully upserted. */
  Complete,

  /** An intermediate page must be inserted between the caller and the callee. */
  InsertIntermediate
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

  // The cached hash in this page; the cumulation of the hashes of the sub-tree rooted at this page.
  treeHash: PageDigest|null;

  // A vector of nodes in this page, ordered min to max by key.
  nodes: Node<N, K>[];

  // The page for keys greater-than all keys in nodes.
  highPage: Page<N, K>|null;

  constructor(level: number, nodes: Node<N, K>[])
  {
    this.level    = level;
    this.treeHash = null;
    this.nodes    = nodes;
    this.highPage = null;
  }

  /**
   * Return the cached hash of this page if any, covering the nodes and the
   * sub-tree rooted at `self`.
   */
  hash(): PageDigest|null
  {
    return this.treeHash;
  }

  /**
   * Set the high page pointer for this page.
   *
   * Panics if this page already has a high page linked, or `p` contains no nodes.
   */
  insertHighPage(p: Page<N, K>): void
  {
    if (this.highPage !== null || p.nodes.length === 0)
    {
      throw new Error('Panic: high page already linked or empty nodes');
    }
    this.treeHash = null;
    this.highPage = p;
  }

  /**
   * Perform a depth-first, in-order traversal, yielding each [`Page`] and
   * [`Node`] to `visitor`.
   *
   * If `highPage` is true, this page was linked to from the parent via a
   * high page pointer.
   */
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

  /**
   * Return the minimum key stored in this page.
   */
  minKey(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('No nodes in this page.');
    }
    return this.nodes[0].getKey();
  }

  /**
   * Return the maximum key stored in this page.
   */
  maxKey(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('No nodes in this page.');
    }
    return this.nodes[this.nodes.length - 1].getKey();
  }

  /**
   * Descend down the minimum (left most) path (if any) and return the
   * minimum key in the subtree rooted at `p`.
   */
  minSubtreeKey(): K
  {
    const v = this.nodes[0]?.getLtPointer();
    if (typeof v?.minSubtreeKey === 'function')
    {
      return v.minSubtreeKey();
    }
    return this.minKey();
  }

  /**
   * Chase the high page pointers to the maximum page value of the subtree
   * rooted at `p`.
   */
  maxSubtreeKey(): K
  {
    if (this.highPage !== null)
    {
      return this.highPage.maxSubtreeKey();
    }
    return this.maxKey();
  }

  /**
   * Generate the page hash and cache the value, covering the nodes and the
   * sub-tree rooted at `self`.
   */
  maybeGenerateHash(hasher: Hasher<N>): void
  {
    if (this.treeHash !== null)
    {
      return;
    }

    let h = hasher.clone();

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
      const keyForHash = typeof n.getKey()?.toString === 'function' ? n.getKey().toString() : n.getKey() as string;
      h.update(keyForHash);
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

  /**
   * Insert or update the value hash of `key`, setting it to `value`, found
   * at tree `level`.
   *
   * Returns true if the key was found, or false otherwise.
   *
   * If the key is found/modified, the cached page hash is invalidated.
   */
  upsert(key: K, level: number, value: ValueDigest<N>): UpsertResult
  {
    if (level < this.level)
    {
      // A non-zero page can never be empty, and level is less than
      // this page, which means this page must be non-zero.
      if (this.level !== 0)
      {
        console.assert(this.nodes.length > 0);
      }

      // Find the node that is greater-than-or-equal-to key to descend
      // into.
      //
      // Otherwise insert this node into the high page.
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

      // Level is more than this page's level
      const result = page.upsert(key, level, value);
      if (result === UpsertResult.InsertIntermediate)
      {
        insertIntermediatePage(page, key, level, value);
      }
    }
    else if (level === this.level)
    {
      this.upsertNode(key, value);
    }
    // Level is more than this page's level
    else
    {
      // This level is lower than the desired level, the parent is
      // higher than the desired level.
      //
      // Returning false will case the parent will insert a new page.
      return UpsertResult.InsertIntermediate; // No need to update the hash of this subtree
    }

    // This page, or one below it was modified. Invalidate the pre-computed
    // page hash, if any.
    //
    // This marks the page as "dirty" causing the hash to be recomputed on
    // demand, coalescing multiple updates instead of hashing for each.
    this.treeHash = null;
    return UpsertResult.Complete;
  }

  /**
   * Insert a node into this page, splitting any child pages as necessary.
   */
  upsertNode(key: K, value: ValueDigest<N>): void
  {
    // Find the appropriate child pointer to follow.
    const idx = this.nodes.findIndex((v) => key <= v.getKey());

    // At this point the new key should be inserted has been identified -
    // node_idx points to the first node greater-than-or-equal to key.
    //
    // In this example, we're inserting the key "C":
    //
    //                                      node_idx
    //                                          ║
    //                                          ║
    //                                          ▼
    //                         ┌──────────┬──────────┐
    //                         │ LT Node  │ GTE Node │
    //                         │    A     │    E     │
    //                         └──────────┴──────────┘
    //                               │          │
    //                        ┌──────┘          │
    //                        ▼                 ▼
    //                  ┌─Page──────┐     ┌─Page──────┐
    //                  │           │     │ ┌───┬───┐ │
    //                  │ Always LT │     │ │ B │ D │ │
    //                  │  new key  │     │ └───┴───┘ │
    //                  └───────────┘     └───────────┘
    //
    // The less-than node never needs splitting, because all the keys within
    // it are strictly less than the insert key.
    //
    // The GTE child page does need splitting - all the keys less than "C"
    // need moving into the new node's less-than page.
    //
    // If the new "C" node will be inserted at the end of the node array,
    // there's no GTE node to check - instead the high page may contain
    // relevant nodes that must be split.

    if (idx !== -1 && this.nodes[idx].getKey() === key)
    {
      this.nodes[idx].updateValueHash(value);
      return;
    }

    let pageToSplit = idx !== -1 ? this.nodes[idx].getLtPointer() : this.highPage;

    // Split the higher-page, either within a GTE node or the high page.
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
}
