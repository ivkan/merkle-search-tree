import { Page } from '../page';

/**
 * Split `page`, mutating it such that it contains only nodes with keys ordered
 * strictly-less than `key`, returning a new `Page` containing the
 * greater-than-or-equal-to nodes.
 *
 * If splitting `page` would leave it with no nodes, it is set to `null`.
 *
 * NOTE: this only splits the page provided - it is up to the caller to split
 * any high pages as necessary.
 *
 * @throws Error if attempting to split a non-empty page (root pages are never split).
 */
export function splitOffLt<K>(page: Page<K>|undefined, key: K): Page<K>|null
{
  if (!page) return null;
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
      page.treeHash = null;
    }
    return ltPage;
  }

  // All the nodes are less than key.
  //
  // As an optimisation, simply return the existing page as the new page
  // (retaining the pre-computed hash if possible) and invalidate the old
  // page.
  if (partitionIdx === -1) // page.nodes.length
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
      page.treeHash = null;
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
      console.log('gteHighPage');
    }
    else
    {
      page.setNull();
      console.log('null', page);
    }

    return ltPage;
  }

  // Invalidate the page hash as at least one node will be removed.
  page.treeHash = null;

  // Obtain the set of nodes that are greater-than-or-equal-to "key".
  const gteNodes = page.nodes.splice(partitionIdx);
  console.log('gtePage', {
    gteNodes,
    partitionIdx,
    'page.nodes': page.nodes
  });
  console.assert(gteNodes.length > 0);

  // page now contains the lt nodes, and a high page that may be non-empty
  // and gte than key.

  // Initialise a new page to hold the gte nodes.
  const gtePage = new Page(page.level, gteNodes);
  console.assert(gtePage.maxKey() > key);

  // Move the input high page onto the new gte page (which continues to be gte
  // than the nodes taken from the input page).
  if (page.highPage)
  {
    console.assert(page.highPage.nodes.length > 0);
    console.assert(page.highPage.level < page.level);
    console.assert(page.highPage.minKey() > key);
    gtePage.insertHighPage(page.highPage);
    page.highPage = null;
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
}
