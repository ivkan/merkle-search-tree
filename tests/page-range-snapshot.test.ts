import { PageRange } from '../src/diff/page-range'
import { PageRangeSnapshot } from '../src/diff/page-range-snapshot'
import { PageDigest } from '../src/digest/wrappers'
import { diff } from '../src/diff'
import { MerkleSearchTree } from '../src/tree'

describe('PageRangeSnapshot', () =>
{
  test('owned usage', () =>
  {
    let a = new MerkleSearchTree();
    let b = new MerkleSearchTree();

    a.upsert('bananas', 42);
    b.upsert('bananas', 24);

    // Rehash the tree
    a.rootHash();
    b.rootHash();

    // Generate owned snapshots from the borrowed page ranges
    let snapA = PageRangeSnapshot.from(a.serialisePageRanges());
    let snapB = PageRangeSnapshot.from(b.serialisePageRanges());

    // Tree should be mutable whilst snapshots are in scope
    a.upsert('bananas', 13);
    b.upsert('bananas', 13);

    // Which should be usable for diff generation (and not reflect the
    // updated state since the trees were mutated).
    let diffResult = diff(snapA.iter(), snapB.iter());
    expect(diffResult).toHaveLength(1);
    expect(diffResult[0].start).toBe('bananas');
    expect(diffResult[0].end).toBe('bananas');
  });

  test('collect equivalence refs', () =>
  {
    const a1 = [
      new PageRange(
        'a',
        'b',
        new PageDigest([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
      ),
      new PageRange(
        'c',
        'd',
        new PageDigest([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2])
      ),
    ];

    const a2         = PageRangeSnapshot.from(a1);
    const a1Snapshot = PageRangeSnapshot.from(a1);

    expect(a1Snapshot).toEqual(a2);
  });

  // Add more tests as needed
});
