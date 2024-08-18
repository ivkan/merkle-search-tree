import { Page } from '../page';

export function splitOffLt<K>(page: Page<K>|undefined, key: K): Page<K>|undefined
{
  if (page === null)
  {
    return null;
  }

  const partition_idx = page.nodes.findIndex(v => key > v.getKey());

  if (partition_idx === -1)
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
}
