import { Page } from '../page';

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
export function splitOffLt<K>(page: Page<K>|undefined, key: K): Page<K>|undefined
{
  if (!page) return undefined;

  if (page.nodes.length === 0)
  {
    throw new Error('Cannot split an empty page');
  }

  // A page should be split into two parts - one page containing the elements
  // less-than "key", and one containing parts greater-or-equal to "key".
  const partitionIdx = page.nodes.findIndex(v => key <= v.getKey());

  // All the nodes are greater-than-or-equal-to "key" - there's no less-than
  // nodes to return.
  if (partitionIdx === -1)
  {
    if (page.minKey() <= key)
    {
      // throw new Error('Assertion failed: page.minKey() > key');
    }

    // The first gte node may have a lt_pointer with nodes that are lt key.
    const ltPage = splitOffLt(page.nodes[0].getLtPointer(), key);
    if (ltPage)
    {
      // Invalidate the page hash as the lt_page was split or the keys
      // moved, changing the content the hash covers.
      page.treeHash = undefined;
      return ltPage;
    }
    return undefined;
  }

  // All the nodes are less than key.
  if (partitionIdx === page.nodes.length)
  {
    if (page.maxKey() >= key)
    {
      throw new Error('Assertion failed: page.maxKey() < key');
    }

    // The page may have a high page, which may have nodes within the
    // (max(nodes.key), key) range
    const ltHighNodes = splitOffLt(page.highPage, key);

    // If existing the high page was split (both sides are non-empty) then
    // invalidate the page hash.
    if (ltHighNodes && page.highPage)
    {
      page.treeHash = undefined;
    }

    // Put the lt nodes back into the high page, taking the gte nodes from
    // the high page.
    const gteHighPage = page.highPage;
    page.highPage     = ltHighNodes;

    // Initialise the page we're about to return.
    const ltPage = new Page(page.level, page.nodes);
    page.nodes   = [];

    // Put the gte nodes into the input page, if any (page should contain
    // all gte nodes after this split).
    if (gteHighPage)
    {
      Object.assign(page, gteHighPage);
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
  if (gteNodes.length === 0)
  {
    throw new Error('Assertion failed: !gteNodes.isEmpty()');
  }

  // Initialise a new page to hold the gte nodes.
  const gtePage = new Page(page.level, gteNodes);
  if (gtePage.maxKey() <= key)
  {
    throw new Error('Assertion failed: gtePage.maxKey() > key');
  }

  // Move the input high page onto the new gte page (which continues to be gte
  // than the nodes taken from the input page).
  if (page.highPage)
  {
    if (page.highPage.nodes.length === 0)
    {
      throw new Error('Assertion failed: !h.nodes.isEmpty()');
    }
    if (page.highPage.level >= page.level)
    {
      throw new Error('Assertion failed: h.level < page.level');
    }
    if (page.highPage.minKey() <= key)
    {
      throw new Error('Assertion failed: h.minKey() > key');
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
  if (ltPage.nodes.length === 0)
  {
    throw new Error('Assertion failed: !ltPage.nodes.isEmpty()');
  }
  if (ltPage.maxKey() >= key)
  {
    throw new Error('Assertion failed: ltPage.maxKey() < key');
  }

  // Insert the high page, if any.
  if (ltKeyHighNodes)
  {
    if (ltKeyHighNodes.level >= page.level)
    {
      throw new Error('Assertion failed: h.level < page.level');
    }
    if (ltKeyHighNodes.maxKey() >= key)
    {
      throw new Error('Assertion failed: h.maxKey() < key');
    }
    if (ltKeyHighNodes.nodes.length === 0)
    {
      throw new Error('Assertion failed: !h.nodes.isEmpty()');
    }
    ltPage.insertHighPage(ltKeyHighNodes);
  }

  return ltPage;
}

/*describe('splitOffLt', () => {
  it('should split a page correctly', () => {
    // Create a page and populate it with some test data
    const page = new Page<number>(0, [/!* ... *!/]);

    const result = splitOffLt(page, 5);

    // Add your assertions here
    expect(result).toBeDefined();
    expect(result!.maxKey()).toBeLessThan(5);
    expect(page.minKey()).toBeGreaterThanOrEqual(5);
  });

  // Add more test cases...
});*/
