// // TypeScript translation of Rust code
// // Technology Stack: TypeScript
//
// function insertIntermediatePage<N>(
//   childPage: Page<N, any>,
//   key: any,
//   level: number,
//   value: ValueDigest<N>
// ): void {
//   console.assert(childPage.level() < level);
//   console.assert(childPage.nodes.length > 0);
//
//   let ltPage = splitOffLt(childPage, key);
//
//   let gtePage: Page<N, any> | null = null;
//   if (ltPage) {
//     console.assert(level > ltPage.level);
//     console.assert(ltPage.nodes.length > 0);
//     console.assert(ltPage.maxKey() < key);
//
//     const highPageLt = splitOffLt(ltPage.highPage, key);
//     gtePage = ltPage.highPage;
//     ltPage.highPage = highPageLt ? new Box(highPageLt) : null;
//     if (gtePage) {
//       console.assert(level > gtePage.level);
//       console.assert(gtePage.nodes.length > 0);
//       console.assert(gtePage.maxKey() > key);
//     }
//   }
//
//   // Create the new node.
//   const node = new Node(key, value, null);
//
//   // Create the new intermediate page, between the parent page and the child
//   // page.
//   let intermediatePage = new Page(level, [node]);
//   if (gtePage) {
//     intermediatePage.insertHighPage(gtePage);
//   }
//
//   // Replace the page pointer at this level to point to the new page, taking
//   // the page that now contains the lt nodes after the split.
//   const replacedPage = childPage;
//   childPage = intermediatePage;
//
//   childPage.nodes[0].ltPointer = ltPage ? new Box(ltPage) : null;
//   if (gtePage && gtePage.nodes.length > 0) {
//     console.assert(gtePage.maxKey() > childPage.nodes[0].key); // "key"
//     console.assert(level > gtePage.level);
//     childPage.highPage = new Box(gtePage);
//   }
// }
