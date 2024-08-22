import { Digest, Node, Page, PageRangeHashVisitor, SipHasher, ValueDigest } from '../src';
import { IntKey } from './test-util';

const MOCK_VALUE: ValueDigest<32> = new ValueDigest(new Digest(new Uint8Array(32)));

describe('PageRangeHashVisitor', () => {

  //                    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  //                      ┌───┬───┬───────┐
  //                    │ │ 7 │11 │ high  │ Level 2 │
  //                      └───┴───┴───────┘
  //                    └ ─ ┬ ─ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ┘
  //                   ┌────┘         └─────────┐
  //                   ▼                        ▼
  //       ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  //         ┌───┬───┬───┐        │   ┌───┬───────┐
  //       │ │ 3 │ 4 │ 6 │Level 1   │ │15 │ high  │ Level 1 │
  //         └───┴───┴───┘        │   └───┴───────┘
  //       └ ─ ┬ ─ ─ ─ ┬ ─ ─ ─ ─ ─  └ ─ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ┘
  //           └┐      └──────────┐           └─────┐
  //            ▼                 ▼                 ▼
  //    ┌ ─ ─ ─ ─ ─ ─ ─ ┐ ┌ ─ ─ ─ ─ ─ ─ ─ ┐ ┌ ─ ─ ─ ─ ─ ─ ─ ┐
  //      ┌───┐             ┌───┐             ┌───┐
  //    │ │ 2 │ Level 0 │ │ │ 5 │ Level 0 │ │ │42 │ Level 0 │
  //      └───┘             └───┘             └───┘
  //    └ ─ ─ ─ ─ ─ ─ ─ ┘ └ ─ ─ ─ ─ ─ ─ ─ ┘ └ ─ ─ ─ ─ ─ ─ ─ ┘
  test('test_page_ranges', () => {
    const lt0 = new Page(0, [new Node(new IntKey(2), MOCK_VALUE, null)]);
    const gt0 = new Page(0, [new Node(new IntKey(5), MOCK_VALUE, null)]);

    const lt1 = new Page(1, [
      new Node(new IntKey(3), MOCK_VALUE, lt0),
      new Node(new IntKey(4), MOCK_VALUE, null),
      new Node(new IntKey(6), MOCK_VALUE, gt0),
    ]);

    const high2 = new Page(1, [new Node(new IntKey(42), MOCK_VALUE, null)]);
    const high = new Page(1, [new Node(new IntKey(15), MOCK_VALUE, null)]);
    high.insertHighPage(high2);

    const root = new Page(2, [
      new Node(new IntKey(7), MOCK_VALUE, lt1),
      new Node(new IntKey(11), MOCK_VALUE, null),
    ]);
    root.insertHighPage(high);

    root.maybeGenerateHash(new SipHasher());

    const v = new PageRangeHashVisitor<16, IntKey>();
    root.inOrderTraversal(v, false);

    const got = v.finalise().map(v => [
      v.getStart().asNumber(),
      v.getEnd().asNumber()
    ]);

    // Pre-order page traversal:
    expect(got).toEqual([[2, 42], [2, 6], [2, 2], [5, 5], [15, 42], [42, 42]]);
  });

  // The root page has a child page, but no values within the subtree are
  // smaller than the root page's minimum.
  test('test_page_range_no_smaller_subtree', () => {
    const level0 = new Page(0, [
      new Node(new IntKey(2), MOCK_VALUE, null),
      new Node(new IntKey(3), MOCK_VALUE, null),
    ]);

    const level1 = new Page(1, [
      new Node(new IntKey(1), MOCK_VALUE, null),
      new Node(new IntKey(4), MOCK_VALUE, level0),
    ]);

    level1.maybeGenerateHash(new SipHasher());

    const v = new PageRangeHashVisitor<16, IntKey>();
    level1.inOrderTraversal(v, false);

    const got = v.finalise().map(v => [
      v.getStart().asNumber(),
      v.getEnd().asNumber()
    ]);

    // Pre-order page traversal:
    expect(got).toEqual([[1, 4], [2, 3]]);
  });
});

