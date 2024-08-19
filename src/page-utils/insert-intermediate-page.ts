import { ValueDigest } from '../digest';
import { splitOffLt } from './split-of-lt';
import { Node } from '../node';
import { Page } from '../page';

export function insertIntermediatePage<N extends number, K>(
  child_page: Page<N, K>,
  key: K,
  level: number,
  value: ValueDigest<N>,
): void
{
  const lt_page = splitOffLt(child_page, key, updatedPage =>
  {
    child_page = updatedPage;
  });
  let gte_page  = null;

  if (lt_page !== null)
  {
    const high_page_lt = splitOffLt(lt_page.highPage, key, updatedPage =>
    {
      lt_page.highPage = updatedPage;
    });
    gte_page           = lt_page.highPage;
    lt_page.highPage   = high_page_lt;
  }

  const node              = new Node(key, value, null);
  const intermediate_page = new Page(level, [node]);

  if (gte_page !== null)
  {
    intermediate_page.insertHighPage(gte_page);
  }

  const gte_page_ref = child_page;
  child_page.nodes[0].setLtPointer(lt_page);

  if (gte_page_ref.nodes.length > 0)
  {
    child_page.highPage = gte_page_ref;
  }
}
