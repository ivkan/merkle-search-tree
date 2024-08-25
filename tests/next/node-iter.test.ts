import { Digest, ValueDigest, Node, Page, NodeIter } from '../../src/next';

const MOCK_VALUE: ValueDigest<32> = new ValueDigest(new Digest(new Uint8Array(32).fill(0)));

describe('Order Test', () =>
{
  test('test_order', () =>
  {
    const lt0 = new Page(0, [new Node(Number(2), MOCK_VALUE, null)]);
    const gt0 = new Page(0, [new Node(Number(5), MOCK_VALUE, null)]);

    const lt1 = new Page(1, [
      new Node(Number(3), MOCK_VALUE, lt0),
      new Node(Number(4), MOCK_VALUE, null),
      new Node(Number(6), MOCK_VALUE, gt0),
    ]);

    const high2 = new Page(1, [new Node(Number(42), MOCK_VALUE, null)]);
    const high  = new Page(1, [new Node(Number(15), MOCK_VALUE, null)]);
    high.insertHighPage(high2);

    const root = new Page(2, [
      new Node(Number(7), MOCK_VALUE, lt1),
      new Node(Number(11), MOCK_VALUE, null),
    ]);
    root.insertHighPage(high);

    const keyOrder = Array.from(new NodeIter(root))
      .map(v => v.key)
      .filter((key) => key !== undefined);

    expect(keyOrder).toEqual([2, 3, 4, 5, 6, 7, 11, 15, 42]);
  });
});

