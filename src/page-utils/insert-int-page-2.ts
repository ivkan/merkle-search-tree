import { Page } from '../page';
import { Node } from '../node';
import { splitOffLt } from './split-of-lt';
import { ValueDigest } from '../digest';

export function insertIntermediatePage<N extends number, K, T extends {deref(): Page<N, K>}>(
  childPage: T,
  key: K,
  level: number,
  value: ValueDigest<N>
): void
{
  // Debug assertions
  console.assert(childPage.deref().level < level);
  console.assert(childPage.deref().nodes.length > 0);

  // Split the child page
  let ltPage: Page<N, K>|undefined = splitOffLt(childPage.deref(), key, updatedPage =>
  {

  });

  let gtePage: Page<N, K>|undefined;
  if (ltPage)
  {
    console.assert(level > ltPage.level);
    console.assert(ltPage.nodes.length > 0);
    console.assert(ltPage.maxKey() < key);

    const highPageLt = splitOffLt(ltPage.highPage, key, updatedPage =>
    {

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

  // Replace the page pointer at this level to point to the new page, taking
  // the page that now contains the lt nodes after the split.
  const gtePage2  = childPage.deref();

  // At this point, we have this structure:
  //
  //                         ┌─────────────┐
  //                         │  This Page  │
  //                         └─────────────┘
  //                                │
  //                                ▼
  //                      ┌───────────────────┐
  //                      │ Intermediate Page │
  //                      └───────────────────┘
  //
  // The lt_page and gtw_pages need linking into the new node within the new
  // intermediate page.

  childPage.deref = () => intermediatePage;

  // Link the pages
  intermediatePage.nodes[0].setLtPointer(ltPage);
  if (gtePage2.nodes.length > 0)
  {
    console.assert(gtePage2.maxKey() > intermediatePage.nodes[0].getKey());
    console.assert(level > gtePage2.level);
    intermediatePage.highPage = gtePage2;
  }
}
