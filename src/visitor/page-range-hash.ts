import { Visitor } from './Visitor';
import { PageRange, Node, Page } from './types';

// Record the page range & hashes for the visited pages.
export class PageRangeHashVisitor<K> implements Visitor<K> {
  private out: PageRange<K>[] = [];

  visitNode(_node: Node<K>): boolean {
    return true;
  }

  visitPage(page: Page<K>, _highPage: boolean): boolean {
    this.out.push(PageRange.from(page));
    return true;
  }

  finalise(): PageRange<K>[] {
    return this.out;
  }
}

// Test module
import { SipHasher24 } from 'siphasher';
import { Digest, ValueDigest } from './digest';
import { IntKey } from './test_util';

const MOCK_VALUE: ValueDigest<32> = new ValueDigest(new Digest(new Uint8Array(32)));

describe('PageRangeHashVisitor', () => {
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

    root.maybeGenerateHash(new SipHasher24());

    const v = new PageRangeHashVisitor<IntKey>();
    root.inOrderTraversal(v, false);

    const got = v.finalise().map(v => [v.start()!, v.end()!]);

    // Pre-order page traversal:
    expect(got).toEqual([[2, 42], [2, 6], [2, 2], [5, 5], [15, 42], [42, 42]]);
  });

  test('test_page_range_no_smaller_subtree', () => {
    const level0 = new Page(0, [
      new Node(new IntKey(2), MOCK_VALUE, null),
      new Node(new IntKey(3), MOCK_VALUE, null),
    ]);

    const level1 = new Page(1, [
      new Node(new IntKey(1), MOCK_VALUE, null),
      new Node(new IntKey(4), MOCK_VALUE, level0),
    ]);

    level1.maybeGenerateHash(new SipHasher24());

    const v = new PageRangeHashVisitor<IntKey>();
    level1.inOrderTraversal(v, false);

    const got = v.finalise().map(v => [v.start()!, v.end()!]);

    // Pre-order page traversal:
    expect(got).toEqual([[1, 4], [2, 3]]);
  });
});

