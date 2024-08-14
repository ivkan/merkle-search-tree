import { assertMatches } from 'assert-matches';
import { Page } from '../src/page';
import { PageDigest, ValueDigest } from '../src/digest/wrappers';

const MOCK_VALUE: ValueDigest<1> = ValueDigest.new(new Digest(new Uint8Array(1).fill(0)));
const MOCK_PAGE_HASH: PageDigest = PageDigest.new(new Uint8Array(16).fill(0));

describe('tests', () => {
  it('test_split_page_empty', () => {
    let gtePage: Page<1> | null = new Page(42, []);
    expect(() => splitOffLt(gtePage, 5)).toThrowError("!page_ref.nodes.is_empty()");
  });

  it('test_split_page_single_node_lt', () => {
    let gtePage: Page<1> = new Page(42, [Node.new(2, MOCK_VALUE, null)]);
    gtePage.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(gtePage, 5);
    expect(gtePage).toBeNull();

    expect(ltPage).toMatchObject({
      level: 42,
      treeHash: MOCK_PAGE_HASH,
      nodes: [Node.new(2, MOCK_VALUE, null)],
    });
  });

  it('test_split_page_single_node_gt', () => {
    let gtePage: Page<1> = new Page(42, [Node.new(2, MOCK_VALUE, null)]);
    gtePage.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(gtePage, 1);
    expect(gtePage).toMatchObject({
      level: 42,
      treeHash: MOCK_PAGE_HASH,
      nodes: [Node.new(2, MOCK_VALUE, null)],
    });

    expect(ltPage).toBeNull();
  });

  it('test_split_page_single_node_gt_with_high_page_split', () => {
    let highPage = new Page(40, [
      Node.new(10, MOCK_VALUE, null),
      Node.new(15, MOCK_VALUE, null),
    ]);
    highPage.treeHash = MOCK_PAGE_HASH;

    let page = new Page(42, [Node.new(5, MOCK_VALUE, null)]);
    page.treeHash = MOCK_PAGE_HASH;
    page.insertHighPage(highPage);

    const ltPage = splitOffLt(page, 12);
    expect(page).toMatchObject({
      level: 40,
      treeHash: null,
      nodes: [Node.new(15, MOCK_VALUE, null)],
      highPage: null,
    });

    expect(ltPage).toMatchObject({
      level: 42,
      treeHash: null,
      nodes: [Node.new(5, MOCK_VALUE, null)],
      highPage: {
        nodes: [Node.new(10, MOCK_VALUE, null)],
        treeHash: null,
      },
    });
  });

  it('test_split_page_single_node_gt_with_child_page_split', () => {
    const child2 = new Page(40, [
      Node.new(1, MOCK_VALUE, null),
      Node.new(3, MOCK_VALUE, null),
    ]);
    const child1 = new Page(41, [Node.new(4, MOCK_VALUE, child2)]);

    let page = new Page(42, [Node.new(5, MOCK_VALUE, child1)]);
    page.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(page, 2);
    expect(page).toMatchObject({
      level: 42,
      treeHash: null,
      nodes: [
        Node.new(5, MOCK_VALUE, {
          level: 41,
          nodes: [Node.new(4, MOCK_VALUE, {
            level: 40,
            nodes: [Node.new(3, MOCK_VALUE, null)],
          })],
        }),
      ],
    });

    expect(ltPage).toMatchObject({
      level: 40,
      nodes: [Node.new(1, MOCK_VALUE, null)],
      treeHash: null,
    });
  });

  it('test_split_page_eq', () => {
    let gtePage: Page<1> = new Page(42, [
      Node.new(1, MOCK_VALUE, null),
      Node.new(2, MOCK_VALUE, null),
      Node.new(4, MOCK_VALUE, null),
    ]);
    gtePage.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(gtePage, 2);
    expect(gtePage).toMatchObject({
      level: 42,
      treeHash: null,
      nodes: [Node.new(2, MOCK_VALUE, null), Node.new(4, MOCK_VALUE, null)],
    });

    expect(ltPage).toMatchObject({
      level: 42,
      treeHash: null,
      nodes: [Node.new(1, MOCK_VALUE, null)],
    });
  });

  it('test_split_page_lt', () => {
    let gtePage: Page<1> = new Page(42, [
      Node.new(1, MOCK_VALUE, null),
      Node.new(2, MOCK_VALUE, null),
      Node.new(4, MOCK_VALUE, null),
    ]);
    gtePage.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(gtePage, 3);
    expect(gtePage).toMatchObject({
      level: 42,
      treeHash: null,
      nodes: [Node.new(4, MOCK_VALUE, null)],
    });

    expect(ltPage).toMatchObject({
      level: 42,
      treeHash: null,
      nodes: [Node.new(1, MOCK_VALUE, null), Node.new(2, MOCK_VALUE, null)],
    });
  });

  it('test_split_page_all_gt', () => {
    let gtePage: Page<1> = new Page(42, [
      Node.new(1, MOCK_VALUE, null),
      Node.new(2, MOCK_VALUE, null),
      Node.new(4, MOCK_VALUE, null),
    ]);
    gtePage.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(gtePage, 0);
    expect(gtePage).toMatchObject({
      level: 42,
      treeHash: MOCK_PAGE_HASH,
      nodes: [
        Node.new(1, MOCK_VALUE, null),
        Node.new(2, MOCK_VALUE, null),
        Node.new(4, MOCK_VALUE, null),
      ],
    });

    expect(ltPage).toBeNull();
  });

  it('test_split_page_all_lt', () => {
    let gtePage: Page<1> = new Page(42, [
      Node.new(1, MOCK_VALUE, null),
      Node.new(2, MOCK_VALUE, null),
      Node.new(4, MOCK_VALUE, null),
    ]);
    gtePage.treeHash = MOCK_PAGE_HASH;

    const ltPage = splitOffLt(gtePage, 10);
    expect(gtePage).toBeNull();

    expect(ltPage).toMatchObject({
      level: 42,
      treeHash: MOCK_PAGE_HASH,
      nodes: [
        Node.new(1, MOCK_VALUE, null),
        Node.new(2, MOCK_VALUE, null),
        Node.new(4, MOCK_VALUE, null),
      ],
    });
  });

  it('test_upsert_less_than_split_child', () => {
    let p = new Page(1, [Node.new(4, MOCK_VALUE, null)]);

    p.upsert(3, 0, MOCK_VALUE);
    p.upsert(1, 0, MOCK_VALUE);
    p.upsert(2, 1, MOCK_VALUE);

    assertTree(p);
  });

  it('test_split_page_recursive_lt_pointer', () => {
    let ltPointerPage = new Page(52, [Node.new(86, MOCK_VALUE, null)]);
    ltPointerPage.treeHash = MOCK_PAGE_HASH;

    let root = new Page(42, [Node.new(161, MOCK_VALUE, ltPointerPage)]);
    root.treeHash = MOCK_PAGE_HASH;

    const key = 160;

    const ltPage = splitOffLt(root, key);
    expect(ltPage).toMatchObject({
      level: 52,
      nodes: expect.arrayContaining([expect.objectContaining({ key: 86 })]),
    });
  });

  it('test_split_page_recursive_high_page', () => {
    let highPage = new Page(32, [Node.new(44, MOCK_VALUE, null)]);
    highPage.treeHash = MOCK_PAGE_HASH;

    let root = new Page(42, [Node.new(42, MOCK_VALUE, null)]);
    root.treeHash = MOCK_PAGE_HASH;
    root.insertHighPage(highPage);

    const key = 43;

    const ltPage = splitOffLt(root, key);

    expect(ltPage).toMatchObject({
      level: 42,
      nodes: expect.arrayContaining([expect.objectContaining({ key: 42 })]),
    });
    expect(root).toMatchObject({
      level: 32,
      nodes: expect.arrayContaining([expect.objectContaining({ key: 44 })]),
    });
  });
});

