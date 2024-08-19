import { Page, Node, MerkleSearchTree, ValueDigest, Digest } from '../src';
import { LevelKey } from './test-util';

const MOCK_VALUE: ValueDigest<32> = new ValueDigest(new Digest(new Uint8Array(32).fill(0)));

describe('Tree Tests', () =>
{
  test('test_dot_flat', () =>
  {
    const p = new Page(
      42,
      [
        new Node('k1', MOCK_VALUE, null),
        new Node('k2', MOCK_VALUE, null),
      ]
    );

    expect(p).toMatchSnapshot();
  });

  test('test_dot_high_page', () =>
  {
    const h = new Page(0, [new Node('z_high1', MOCK_VALUE, null)]);

    const p = new Page(
      42,
      [
        new Node('k1', MOCK_VALUE, null),
        new Node('k2', MOCK_VALUE, null),
      ]
    );
    p.insertHighPage(h);

    expect(p).toMatchSnapshot();
  });

  test('test_dot_lt_pointer', () =>
  {
    const ltPage1 = new Page(1, [new Node('lt1', MOCK_VALUE, null)]);
    const ltPage2 = new Page(
      2,
      [new Node('lt2', MOCK_VALUE, ltPage1)]
    );

    const p = new Page(
      42,
      [
        new Node('z_k1', MOCK_VALUE, ltPage2),
        new Node('z_k2', MOCK_VALUE, null),
      ]
    );

    expect(p).toMatchSnapshot();
  });

  test('test_dot_high_page_lt_pointer', () =>
  {
    const ltPage1 = new Page(10, [new Node('lt1', MOCK_VALUE, null)]);
    const ltPage2 = new Page(
      11,
      [new Node('lt2', MOCK_VALUE, ltPage1)]
    );

    const h1 = new Page(0, [new Node('zz_h1', MOCK_VALUE, null)]);
    const h2 = new Page(1, [new Node('zz_h2', MOCK_VALUE, h1)]);

    const p = new Page(
      42,
      [
        new Node('z_k1', MOCK_VALUE, ltPage2),
        new Node('z_k2', MOCK_VALUE, null),
      ]
    );
    p.insertHighPage(h2);

    expect(p).toMatchSnapshot();
  });

  test('test_parent_lookup', () =>
  {
    const MOCK_VALUE_1: ValueDigest<1> = new ValueDigest(new Digest(new Uint8Array(1).fill(0)));

    const p = new Page(1, [new Node(4, MOCK_VALUE_1, null)]);

    p.upsert(3, 0, MOCK_VALUE_1);
    p.upsert(1, 0, MOCK_VALUE_1);
    p.upsert(2, 1, MOCK_VALUE_1);

    expect(p).toMatchSnapshot();
  });

  test('test_linear_children', () =>
  {
    const t = new MerkleSearchTree();

    t.upsert(new LevelKey('I', 2), 'bananas');
    t.upsert(new LevelKey('E', 1), 'bananas');
    t.upsert(new LevelKey('F', 0), 'bananas');

    expect(t).toMatchSnapshot();
  });
});

