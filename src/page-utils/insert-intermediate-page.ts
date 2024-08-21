import { splitOffLt } from './split-of-lt';
import { ValueDigest } from '../digest';
import { Page } from '../page';
import { Node } from '../node';

export function insertIntermediatePage<N extends number, K>(
  childPage: Page<N, K>,
  key: K,
  level: number,
  value: ValueDigest<N>
): void
{
  // Terminology:
  //
  //     * parent_page: top of the stack, parent of childPage
  //     * intermediate/new page: intermediate page with level between parent_page
  //       and childPage to be inserted between them.
  //     * childPage: the lower page, child of parent_page
  //

  // The child page asked this page to insert a new intermediate page at this
  // location.
  //
  //                        ┌──────────┐
  //                        │ New Root │
  //                   ┌────│    B     │─────┐         Level N
  //                   │    └──────────┘     │
  //              lt_pointer            high_page
  //                   │                     │
  //                   │                     │
  //          ┌ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  //             ┌─────▼────┐          ┌─────▼────┐
  //          │  │ LT Node  │          │ GTE Node │  Child Page │
  //             │    A     │          │    C     │     Level 0
  //          │  └──────────┘          └──────────┘             │
  //           ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  //
  // The child page must be split into nodes less-than key, and those
  // greater-than-or-equal to key to preserve the ordering once this new page
  // containing key is inserted. Both halves must be linked into the new page.
  console.assert(childPage.level < level);
  console.assert(childPage.nodes.length > 0);

  // Split the child page into (less-than, greater-than) pages, split at the
  // point where key would reside.
  //
  // NOTE: this may leave "page" empty if all the nodes moved to the lt page.
  let ltPage: Page<N, K>|undefined = splitOffLt(childPage, key, updatedPage =>
  {
    childPage = updatedPage;
  });

  // If all the nodes moved out of the childPage and into lt_page it
  // indicates that all nodes had keys less-than the new key, meaning there
  // may be nodes in the lt_page high page that need splitting, as it may
  // contain values between max(lt_page.nodes) and key.
  //
  // For example, when inserting 4:
  //
  //                              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─
  //                                ┌───┐ New Parent │
  //                           ┌──│ │ 4 │    Level 2
  //                           │    └───┘            │
  //                           │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─
  //                           │
  //                ┌ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  //                   ┌───┬───▼───────┐  Child Page │
  //                │  │ 1 │ 2 │ high  │     Level 1
  //                   └───┴───┴───────┘             │
  //                └ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─
  //                               │
  //                           ┌ ─ ▼ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  //                             ┌───┬───┐
  //                           │ │ 3 │ 5 │   Level 0 │
  //                             └───┴───┘
  //                           └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
  //
  // The existing entry of 5 must be moved, as it is greater than the new
  // parent:
  //
  //                              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  //                                            New Parent │
  //                              │ ┌───┬───────┐  Level 2
  //                            ┌───│ 4 │ high  │───┐      │
  //                            │ │ └───┴───────┘   │
  //                            │  ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ┘
  //                            ▼                   │
  //           ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │
  //              ┌───┬───┬───────┐  Child Page │   │
  //           │  │ 1 │ 2 │ high  │     Level 1     │
  //              └───┴───┴───────┘             │   │
  //           └ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─    │
  //                          ▼                     ▼
  //                  ┌ ─ ─ ─ ─ ─ ─ ─       ┌ ─ ─ ─ ─ ─ ─ ─
  //                   ┌───┐         │       ┌───┐         │
  //                  ││ 3 │ Level 0        ││ 5 │ Level 0
  //                   └───┘         │       └───┘         │
  //                  └ ─ ─ ─ ─ ─ ─ ─       └ ─ ─ ─ ─ ─ ─ ─
  //
  // To do this, we split the high page, attaching the lt_nodes to the lt_page
  // created above, and attach the remaining gte_nodes to the high_page of the
  // intermediate_page.
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

  // Create the new node.
  const node = new Node(key, value);

  // Create the new intermediate page, between the parent page and the child
  // page.
  const intermediatePage = new Page(level, [node]);
  if (gtePage)
  {
    intermediatePage.insertHighPage(gtePage);
  }

  // Replace the page pointer at this level to point to the new page, taking
  // the page that now contains the lt nodes after the split.
  const oldPage = childPage;
  childPage     = intermediatePage;

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
  childPage.nodes[0].setLtPointer(ltPage);

  if (oldPage?.nodes.length > 0)
  {
    console.assert(oldPage.maxKey() > childPage.nodes[0].getKey());
    console.assert(level > oldPage.level);
    childPage.highPage = oldPage;
  }
}



