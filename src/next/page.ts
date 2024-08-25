import { PageDigest, SipHasher, ValueDigest } from './digest';
import { Node } from './node';
import { Visitor } from './visitor';
import { notNil } from './utils/not-nil';

export enum UpsertResult
{
  Complete,
  InsertIntermediate,
}

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
      throw new Error('High page already linked or empty nodes');
    }
    this.treeHash = null;
    this.highPage = p;
  }

  inOrderTraversal<T extends Visitor<N, K>>(visitor: T, highPage: boolean): boolean
  {
    if (!visitor.visitPage(this, highPage))
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
      throw new Error('No nodes in page');
    }
    return this.nodes[0].key;
  }

  maxKey(): K
  {
    if (this.nodes.length === 0)
    {
      throw new Error('No nodes in page');
    }
    return this.nodes[this.nodes.length - 1].key;
  }

  minSubtreeKey(): K
  {
    const v = this.nodes[0].ltPointer;
    if (v !== null)
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

  maybeGenerateHash(hasher: SipHasher): void
  {
    if (this.treeHash !== null)
    {
      return;
    }

    let h = hasher.clone();

    for (const n of this.nodes)
    {
      if (n.ltPointer)
      {
        n.ltPointer.maybeGenerateHash(hasher);
        const childHash = n.ltPointer.hash();
        if (childHash)
        {
          h.write(childHash.valueOf().asBytes());
        }
      }

      h.write(n.key);
      h.write(n.valueHash);
    }

    if (this.highPage)
    {
      this.highPage.maybeGenerateHash(hasher);
      const highHash = this.highPage.hash();
      if (highHash)
      {
        h.write(highHash.valueOf().asBytes());
      }
    }

    this.treeHash = new PageDigest(h.digest());
  }

  upsert(key: K, level: number, value: ValueDigest<N>): UpsertResult
  {
    if (level < this.level)
    {
      const ptr      = findIdx(this.nodes, key);
      const page     = this.nodes[ptr]?.ltPointer ?? this.highPage;
      const page_ref = page ?? new Page(level, []);
      if (page_ref.upsert(key, level, value) === UpsertResult.InsertIntermediate)
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
      return UpsertResult.InsertIntermediate;
    }

    this.treeHash = null;
    return UpsertResult.Complete;
  }

  upsertNode(key: K, value: ValueDigest<N>): void
  {
    const idx         = findIdx(this.nodes, key);
    let page_to_split = this.nodes[idx]?.ltPointer ?? this.highPage;

    let new_lt_page = splitOffLt(page_to_split, key, updatedPage =>
    {
      page_to_split = updatedPage;
    });

    if (notNil(new_lt_page))
    {
      const lt_page     = new_lt_page;
      const highPage_lt = splitOffLt(lt_page.highPage, key, updatedPage =>
      {
        lt_page.highPage = updatedPage;
      });
      const gte_page    = lt_page.highPage;
      lt_page.highPage  = highPage_lt;

      if (notNil(gte_page))
      {
        this.insertHighPage(gte_page);
      }
    }

    this.nodes.splice(idx, 0, new Node(key, value, new_lt_page));
  }
}

export function splitOffLt<N extends number, K>(
  page: Page<N, K>|undefined,
  key: K,
  cb: (updatedPage: Page<N, K>|null) => void
): Page<N, K>|null
{
  const pageRef = page;
  if (!pageRef) return null;

  if (pageRef.nodes.length === 0)
  {
    throw new Error('Page nodes should not be empty');
  }

  // A page should be split into two parts - one page containing the elements
  // less-than "key", and one containing parts greater-or-equal to "key".
  const partitionIdx = findIdx(pageRef.nodes, key);

  // All the nodes are greater-than-or-equal-to "key" - there's no less-than
  // nodes to return.
  if (partitionIdx === page.nodes.length)
  {
    console.assert(pageRef.minKey() <= key, 'Assertion failed: page_ref.minKey() > key');

    // The first gte node may have a ltPointer with nodes that are lt key.
    if (pageRef.nodes[0].ltPointer)
    {
      const v = splitOffLt(pageRef.nodes[0].ltPointer, key, updatedPage =>
      {
        pageRef.nodes[0].ltPointer = updatedPage;
      });

      if (v)
      {
        // Invalidate the page hash as the lt{age was split or the keys
        // moved, changing the content the hash covers.
        pageRef.treeHash = null;
        cb(pageRef);
        return v;
      }
    }
    cb(pageRef);
    return null;
  }

  // All the nodes are less than key.
  //
  // As an optimisation, simply return the existing page as the new page
  // (retaining the pre-computed hash if possible) and invalidate the old
  // page.
  if (partitionIdx === -1)
  {
    console.assert(pageRef.maxKey() >= key, 'Assertion failed: page_ref.max_key() < key')

    // The page may have a high page, which may have nodes within the
    // (max(nodes.key), key) range
    const ltHighNodes = splitOffLt(pageRef.highPage, key, updatedPage =>
    {
      pageRef.highPage = updatedPage;
    });

    // If existing the high page was split (both sides are non-empty) then
    // invalidate the page hash.
    //
    // This effectively invalidates the page range of the returned lt_page
    // as the cached hash covers the high page (which has now been split,
    // changing the content).
    if (ltHighNodes && pageRef.highPage)
    {
      pageRef.treeHash = null;
    }

    // Put the lt nodes back into the high page, taking the gte nodes from
    // the high page.
    //
    // This leaves the ltHighNodes in the high page link of page_ref.
    const gteHighPage = pageRef.highPage;
    pageRef.highPage  = ltHighNodes;
    // const gteHighPage = new Page(pageRef.highPage.level, pageRef.highPage.nodes);
    // pageRef.highPage  = ltHighNodes
    //   ? new Page(pageRef.highPage.level, ltHighNodes.nodes)
    //   : null;

    // Initialise the page we're about to return.
    //
    // This puts an empty page into page_ref, taking the new lt nodes in
    // page (potentially with the high page linked to lt_high_nodes)
    const ltPage = pageRef;
    page         = new Page(pageRef.level, []);

    // Put the gte nodes into the input page, if any (page should contain
    // all gte nodes after this split).
    if (gteHighPage)
    {
      page.nodes = [...gteHighPage.nodes];
    }
    else
    {
      page = null;
    }
    cb(page);

    return ltPage;
  }

  // Invalidate the page hash as at least one node will be removed.
  pageRef.treeHash = null;

  // Obtain the set of nodes that are greater-than-or-equal-to "key".
  const gteNodes = partitionIdx === -1 ? [] : pageRef.nodes.splice(partitionIdx);
  console.assert(gteNodes.length === 0, 'Assertion failed: !gte_nodes.is_empty()');

  // page_ref now contains the lt nodes, and a high page that may be non-empty
  // and gte than key.

  // Initialise a new page to hold the gte nodes.
  const gtePage = new Page(pageRef.level, gteNodes);
  console.assert(gtePage.maxKey() <= key, 'Assertion failed: gte_page.max_key() > key');

  // Move the input high page onto the new gte page (which continues to be gte
  // than the nodes taken from the input page).
  if (pageRef.highPage)
  {
    const h = pageRef.highPage;
    console.assert(h.nodes.length === 0, 'Assertion failed: !h.nodes.is_empty()');
    console.assert(h.level >= pageRef.level, 'Assertion failed: h.level < page_ref.level');
    console.assert(h.minKey() <= key, 'Assertion failed: h.min_key() > key');

    gtePage.insertHighPage(h);
    pageRef.highPage = null;
  }

  // The first gte node may contain a lt_pointer with keys lt key, recurse
  // into it.
  const ltKeyHighNodes = splitOffLt(gtePage.nodes[0].ltPointer, key, updatedPage =>
  {
    gtePage.nodes[0].ltPointer = updatedPage;
  });

  // In which case it is gte all node keys in the lt page (or it wouldn't have
  // been on the gte node).
  //
  // Add this to the new lt_page's high page next.

  // Replace the input page with the gte nodes, taking the page containing the
  // lt nodes and returning them to the caller.
  const ltPage = pageRef;
  page         = gtePage;
  console.assert(ltPage.nodes.length === 0, 'Assertion failed: !lt_page.nodes.is_empty()');
  console.assert(ltPage.maxKey() >= key, 'Assertion failed: lt_page.max_key() < key');

  // Insert the high page, if any.
  if (ltKeyHighNodes)
  {
    console.assert(ltKeyHighNodes.level >= pageRef.level, 'Assertion failed: h.level < page_ref.level');
    console.assert(ltKeyHighNodes.maxKey() >= key, 'Assertion failed: h.max_key() < key');
    console.assert(ltKeyHighNodes.nodes.length === 0, 'Assertion failed: !h.nodes.is_empty()');
    ltPage.insertHighPage(ltKeyHighNodes);
  }

  cb(page);
  return ltPage;
}

export function insertIntermediatePage<N extends number, K>(
  childPage: Page<N, K>,
  key: K,
  level: number,
  value: ValueDigest<N>
): void
{
  // Debug assertions
  console.assert(childPage.level < level);
  console.assert(childPage.nodes.length > 0);

  // Split the child page
  let ltPage: Page<N, K>|undefined = splitOffLt(childPage, key, updatedPage =>
  {
    childPage = updatedPage;
  });

  let gtePage: Page<N, K>|undefined;
  if (ltPage)
  {
    console.assert(level > ltPage.level);
    console.assert(ltPage.nodes.length > 0);
    console.assert(ltPage.maxKey() < key);

    const highPageLt = splitOffLt(ltPage.highPage, key, updatedPage =>
    {
      ltPage.highPage = updatedPage;
    });
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
  const oldPage = childPage;
  childPage     = intermediatePage;

  // Link the pages
  intermediatePage.nodes[0].ltPointer = ltPage;
  if (oldPage.nodes.length > 0)
  {
    console.assert(oldPage.maxKey() > intermediatePage.nodes[0].key);
    console.assert(level > oldPage.level);
    intermediatePage.highPage = oldPage;
  }
}

function findIdx<N extends number, K>(nodes: Node<N, K>[], key: K): number
{
  return nodes.findIndex(v => key <= v.key) || nodes.length;
}

