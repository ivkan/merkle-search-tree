import { diff, DiffRange, PageDigest, PageRange } from '../../src/next';
import { TestNode } from './test-util';

const newDigest = (lsb: number): PageDigest =>
{
  return new PageDigest(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, lsb]));
};

const testPageIsSupersetOf = (name: string, aStart: number, aEnd: number, bStart: number, bEnd: number, want: boolean) =>
{
  test(`test_page_is_superset_of_${name}`, () =>
  {
    const a = new PageRange(aStart, aEnd, newDigest(42));
    const b = new PageRange(bStart, bEnd, newDigest(42));

    expect(a.isSupersetOf(b)).toBe(want);
  });
};

describe('diff tests', () =>
{
  testPageIsSupersetOf('inclusive', 1, 10, 1, 10, true);
  testPageIsSupersetOf('full', 1, 10, 2, 9, true);
  testPageIsSupersetOf('start', 2, 10, 1, 9, false);
  testPageIsSupersetOf('end', 1, 8, 2, 9, false);
  testPageIsSupersetOf('outside', 1, 10, 0, 11, false);

  test('custom_test', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
    ];

    const peer = [
      new PageRange(3, 15, newDigest(42)),
      new PageRange(3, 6, newDigest(43)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(16, 18, newDigest(5)),
    ];

    expect(diff(local, peer).length === 0).toBeTruthy();
  });

  test('test_no_diff', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer   = [...local];
    const result = diff(local, peer);
    console.log(result);

    expect(result.length).toEqual(0);
  });

  test('test_diff_peer_missing_last_page', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [...local];

    // Remove the last page
    peer.pop();

    // Invalidate the root/parent and update the peer root range to reflect
    // the missing last page
    peer[0] = new PageRange(peer[0].start, 11, newDigest(42));

    const result = diff(local, peer);

    // Nothing to ask for - the peer is behind
    expect(result.length).toEqual(0);
  });

  test('test_diff_local_missing_last_page', () =>
  {
    let local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [...local];

    // Remove the last page
    local.pop();

    // Invalidate the root/parent and update the local root range to reflect
    // the missing last page
    local[0] = new PageRange(local[0].start, 11, newDigest(42));

    expect(diff(local, peer)).toEqual([new DiffRange(6, 15)]);
  });

  test('test_diff_peer_missing_leaf_page', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [
      new PageRange(3, 15, newDigest(42)),
      new PageRange(3, 6, newDigest(43)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    expect(diff(local, peer)).toEqual([]);
  });

  test('test_diff_local_missing_leaf_page', () =>
  {
    const local = [
      new PageRange(3, 15, newDigest(42)),
      new PageRange(3, 6, newDigest(43)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    expect(diff(local, peer)).toEqual([new DiffRange(2, 15)]);
  });

  test('test_diff_local_missing_subtree', () =>
  {
    const local = [
      new PageRange(3, 15, newDigest(42)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    expect(diff(local, peer)).toEqual([new DiffRange(2, 15)]);
  });

  test('test_diff_peer_missing_subtree', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [
      new PageRange(3, 15, newDigest(42)),
      new PageRange(15, 15, newDigest(5)),
    ];

    expect(diff(local, peer)).toEqual([]);
  });

  test('test_diff_leaf_page_hash', () =>
  {
    const peer = [
      new PageRange(2, 15, newDigest(42)),
      new PageRange(2, 6, newDigest(42)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    expect(diff(local, peer)).toEqual([new DiffRange(2, 15)]);
  });

  test('test_diff_peer_extra_key_last_page', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer  = [...local];
    const end = peer.pop();
    if (end)
    {
      peer.push(new PageRange(end.start, 16, newDigest(42)));
    }
    peer[0] = new PageRange(peer[0].start, 16, newDigest(42));

    expect(diff(local, peer)).toEqual([new DiffRange(6, 16)]);
  });

  test('test_diff_root_page_hash', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];
    peer[0]  = new PageRange(peer[0].start, peer[0].end, newDigest(42));

    expect(diff(local, peer)).toEqual([new DiffRange(6, 15)]);
  });

  test('test_diff_peer_intermediate_bounds', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];
    peer[1]  = new PageRange(peer[1].start, 7, newDigest(42));
    peer[0]  = new PageRange(peer[0].start, peer[0].end, newDigest(42));

    expect(diff(local, peer)).toEqual([new DiffRange(2, 15)]);
  });

  test('test_diff_peer_intermediate_bounds_and_inconsistent_subtree_leaf', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];
    peer[1]  = new PageRange(peer[1].start, 7, newDigest(42));
    peer[2]  = new PageRange(peer[2].start, peer[2].end, newDigest(42));
    peer[0]  = new PageRange(peer[0].start, peer[0].end, newDigest(42));

    expect(diff(local, peer)).toEqual([new DiffRange(2, 15)]);

    let local2 = [...peer];
    local2[2]  = new PageRange(local2[2].start, local2[2].end, newDigest(3));
    peer[1]    = new PageRange(peer[1].start, peer[1].end, newDigest(2));
    peer[0]    = new PageRange(peer[0].start, peer[0].end, newDigest(1));

    expect(diff(local2, peer)).toEqual([new DiffRange(2, 15)]);
  });

  /*test('test_child_page_inconsistent_no_subtree_recurse', () =>
  {
    const local = [
      new PageRange<bigint>(BigInt(0), 17995215864353464453n, newDigest(1)),
      new PageRange<bigint>(BigInt(0), 1331283967702353742n, newDigest(2)),
      new PageRange(2425302987964992968n, 3632803506728089373n, newDigest(3)),
      new PageRange(4706903583207578752n, 4707132771120484774n, newDigest(4)),
      new PageRange(17995215864353464453n, 17995215864353464453n, newDigest(5)),
    ];

    const peer = [
      new PageRange<bigint>(BigInt(0), 17995215864353464453n, newDigest(11)),
      new PageRange<bigint>(BigInt(0), 1331283967702353742n, newDigest(2)),
      new PageRange(2425302987964992968n, 3541571342636567061n, newDigest(13)),
      new PageRange(3632803506728089373n, 4707132771120484774n, newDigest(14)),
      new PageRange(17995215864353464453n, 17995215864353464453n, newDigest(5)),
    ];

    expect(diff(local, peer)).toEqual([new DiffRange(1331283967702353742n, 17995215864353464453n)]);
  });*/

  test('test_diff_peer_bounds_larger_both_sides', () =>
  {
    const local = [new PageRange(2, 15, newDigest(1))];
    const peer  = [new PageRange(1, 42, newDigest(2))];

    expect(diff(local, peer)).toEqual([new DiffRange(1, 42)]);
  });

  test('test_diff_empty_peer', () =>
  {
    const peer: PageRange<number>[] = [];
    const local                     = [new PageRange(1, 42, newDigest(1))];

    expect(diff(local, peer)).toEqual([]);
  });

  test('test_diff_empty_local', () =>
  {
    const local: PageRange<number>[] = [];
    const peer                       = [new PageRange(1, 42, newDigest(1))];

    expect(diff(local, peer)).toEqual([new DiffRange(1, 42)]);
  });

  test('while 1', () =>
  {
    const to   = new PageRange(42, 42, new PageDigest(
      new Uint8Array([13, 177, 47, 216, 6, 44, 239, 129, 173, 179, 96, 208, 190, 228, 161, 170])
    ));
    const from = new PageRange(42, 42, new PageDigest(
      new Uint8Array([247, 74, 212, 93, 136, 46, 4, 77, 150, 205, 164, 118, 125, 43, 243, 80])
    ));

    const res = diff([to], [from]);

    expect(res).toEqual([{ start: 42, end: 42 }]);
  });

  test('while 2', () =>
  {
    const to   = new PageRange(42, 42, new PageDigest(
      new Uint8Array([247, 74, 212, 93, 136, 46, 4, 77, 150, 205, 164, 118, 125, 43, 243, 80])
    ));
    const from = new PageRange(42, 42, new PageDigest(
      new Uint8Array([247, 74, 212, 93, 136, 46, 4, 77, 150, 205, 164, 118, 125, 43, 243, 80])
    ));

    const res = diff([to], [from]);

    expect(res).toEqual([]);
  });

  test('test_trivial_sync_differing_values', () =>
  {
    let a = new TestNode();
    a.upsert(42, 1);

    let b = new TestNode();
    b.upsert(42, 2);

    expect(syncRound(a, b)).toBe(1);
    expect(syncRound(a, b)).toBe(0);

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(a, b)).toBe(0);

    expect(a).toEqual(b);
  });

  test('test_trivial_sync_differing_keys', () =>
  {
    let a = new TestNode();
    a.upsert(Number(42), 1);

    let b = new TestNode();
    b.upsert(Number(24), 1);

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(1);
    expect(syncRound(b, a)).toBe(0);
    expect(syncRound(a, b)).toBe(2);
    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(a).toEqual(b);
  });

  test('test_local_superset_of_peer', () =>
  {
    let a = new TestNode();
    a.upsert(Number(244067356035258375n), 0);

    let b = new TestNode();
    b.upsert(Number(0), 0);
    b.upsert(Number(2750749774246655017n), 0);

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(2);
    expect(syncRound(a, b)).toBe(3);
    expect(syncRound(b, a)).toBe(0);
    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(a).toEqual(b);
  });

  test('test_root_single_node_covered', () =>
  {
    let a = new TestNode();
    a.upsert(Number(2356959391436047n), 0);
    a.upsert(Number(8090434540343951592n), 0);

    let b = new TestNode();
    b.upsert(Number(1827784367256368463n), 0);
    b.upsert(Number(8090434540329235177n), 0);

    expect(syncRound(a, b)).toBe(2);
    expect(syncRound(b, a)).toBe(4);

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(a).toEqual(b);
  });

  test('test_superset', () =>
  {
    let a = new TestNode();
    a.upsert(Number(1479827427186972579n), 0);
    a.upsert(Number(6895546778622627890n), 0);

    let b = new TestNode();
    b.upsert(Number(0), 0);
    b.upsert(Number(8090434540329235177n), 0);

    expect(syncRound(a, b)).toBe(0);

    expect(syncRound(b, a)).toBe(2);

    expect(syncRound(a, b)).toBe(4);

    expect(syncRound(b, a)).toBe(0);
    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(a).toEqual(b);
  });

  test('test_both_roots_single_differing_node', () =>
  {
    let a = new TestNode();
    a.upsert(Number(3541571342636567061n), 0);
    a.upsert(Number(4706901308862946071n), 0);
    a.upsert(Number(4706903583207578752n), 0);

    let b = new TestNode();
    b.upsert(Number(3632796868130453657n), 0);
    b.upsert(Number(3632803506728089373n), 0);
    b.upsert(Number(4707132771120484774n), 0);

    for (let i = 0; i < 100; i++)
    {
      syncRound(a, b);
      syncRound(b, a);
    }

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(a).toEqual(b);
  });

  test('test_leading_edge_range_sync', () =>
  {
    let a = new TestNode();
    for (let i = 1; i <= 10; i++)
    {
      a.upsert(Number(i), 0);
    }

    let b = new TestNode();
    for (let i = 1; i <= 6; i++)
    {
      b.upsert(Number(i), 0);
    }

    expect(syncRound(a, b)).toBe(10);
    expect(syncRound(b, a)).toBe(0);

    expect(syncRound(a, b)).toBe(0);
    expect(syncRound(b, a)).toBe(0);

    expect(a).toEqual(b);
  });

  const MAX_NODE_KEYS = 100;

  const arbitraryLargeKeySet = () =>
  {
    const kvPairs = new Set<[number, number]>();
    for (let i = 0; i < MAX_NODE_KEYS; i++)
    {
      kvPairs.add([Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)]);
    }
    return kvPairs;
  };

  const arbitrarySmallKeySet = () =>
  {
    const kvPairs = new Set<[number, number]>();
    for (let i = 0; i < MAX_NODE_KEYS; i++)
    {
      kvPairs.add([Math.floor(Math.random() * 50), Math.floor(Math.random() * 50)]);
    }
    return kvPairs;
  };

  const arbitraryNode = () =>
  {
    const node    = new TestNode();
    const kvPairs = Math.random() < 0.5 ? arbitraryLargeKeySet() : arbitrarySmallKeySet();
    for (const [k, v] of kvPairs)
    {
      node.upsert(Number(k), v);
    }
    return node;
  };

  test('prop_sync_trees', () =>
  {
    const a = arbitraryNode();
    const b = arbitraryNode();

    const maxCount = a.keyCount() + b.keyCount() + 1;
    let count      = 0;

    while (true)
    {
      const aToB = syncRound(a, b);
      const bToA = syncRound(b, a);
      if (aToB === 0 && bToA === 0)
      {
        break;
      }

      expect(aToB).toBeLessThanOrEqual(a.keyCount());
      expect(bToA).toBeLessThanOrEqual(b.keyCount());

      count += 1;
      if (count >= maxCount)
      {
        throw new Error('failed to sync a => b in round limit');
      }
    }

    expect(a).toEqual(b);
  });

  /*test('prop_owned_page_range_equivalent', () =>
  {
    const a = arbitraryNode();

    a.rootHash();
    const aRef   = a.serialisePageRanges();
    const aOwned = PageRangeSnapshot.from(aRef);

    const aOwnedIter = aOwned.iter();
    const aRefIter   = aRef.iter().map(range => range.clone());

    expect(aOwnedIter).toEqual(aRefIter);
  });*/

  /**
   * Perform a single sync round, pulling differences from a into b.
   * Returns the number of fetched pages.
   */
  const syncRound = (a: TestNode, b: TestNode): number =>
  {
    // First sync b from a, applying the "a is always right" merge rule.
    // const a2    = from;
    // const aTree = from.pageRanges();
    //
    // const to2  = to;
    // console.log('trees', a.store, b.store);

    const want = diff(b.pageRanges(), a.pageRanges());

    console.log('x___x', {
      to  : extractPageRanges(b.pageRanges())[0],
      from: extractPageRanges(a.pageRanges())[0],
      want
    });

    let count = 0;
    for (const range of want)
    {
      for (const [k, v] of a.keyRangeIter([range.start, range.end]))
      {
        // console.log('x___x', {k,v});
        b.upsert(k, v);
        count += 1;
      }
    }

    return count;
  };
});

export function extractPageRanges(values: PageRange<any>[])
{
  return values.map(value =>
  {
    return {
      start: value?.start,
      end  : value?.end,
      hash : Array.from(value?.hash?.value.asBytes()).join(', ')
    }
  })
}
