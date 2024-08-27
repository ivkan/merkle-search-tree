import { Digest, Node, Page, PageRangeHashVisitor, SipHasher, ValueDigest } from '../../src/next';

const MOCK_VALUE: ValueDigest<32> = new ValueDigest(new Digest(new Uint8Array(32)));

describe('Page Ranges', () =>
{
  test('test_page_ranges', () =>
  {
    const lt0 = new Page(0, [new Node(Number(2), MOCK_VALUE, null)]);
    const gt0 = new Page(0, [new Node(Number(5), MOCK_VALUE, null)]);

    const lt1 = new Page(1, [
      new Node(Number(3), MOCK_VALUE, lt0),
      new Node(Number(4), MOCK_VALUE, null),
      new Node(Number(6), MOCK_VALUE, gt0),
    ]);

    const high2 = new Page(1, [new Node(Number(42), MOCK_VALUE)]);
    const high  = new Page(1, [new Node(Number(15), MOCK_VALUE)]);
    high.insertHighPage(high2);

    const root = new Page(2, [
      new Node(Number(7), MOCK_VALUE, lt1),
      new Node(Number(11), MOCK_VALUE),
    ]);
    root.insertHighPage(high);

    root.maybeGenerateHash(new SipHasher());

    const v = new PageRangeHashVisitor<number, 32>();
    root.inOrderTraversal(v, false);

    const got = v.finalise().map(v => [v.start, v.end]);

    expect(got).toEqual([[2, 42], [2, 6], [2, 2], [5, 5], [15, 42], [42, 42]]);
  });

  test('test_page_range_no_smaller_subtree', () =>
  {
    const level0 = new Page(0, [
      new Node(Number(2), MOCK_VALUE),
      new Node(Number(3), MOCK_VALUE),
    ]);

    const level1 = new Page(1, [
      new Node(Number(1), MOCK_VALUE),
      new Node(Number(4), MOCK_VALUE, level0),
    ]);

    level1.maybeGenerateHash(new SipHasher());

    const v = new PageRangeHashVisitor<number, 32>();
    level1.inOrderTraversal(v, false);

    const got = v.finalise().map(v => [v.start, v.end]);

    expect(got).toEqual([[1, 4], [2, 3]]);
  });
});

