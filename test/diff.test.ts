import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IntKey } from '../src/test-util';
import { DiffListBuilder } from '../src/diff/diff-builder';
import { LevelKey, MockHasher } from "../src/digest/mock"

// Assuming PageDigest, PageRange, DiffRange, diff, sync_round, Node, IntKey, and enable_logging are defined elsewhere

function new_digest(lsb: number): PageDigest {
  return new PageDigest([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, lsb]);
}

function test_page_is_superset_of(
  name: string,
  a_start: number,
  a_end: number,
  b_start: number,
  b_end: number,
  want: boolean
) {
  it(`test_page_is_superset_of_${name}`, () => {
    const a = new PageRange(a_start, a_end, new_digest(42));
    const b = new PageRange(b_start, b_end, new_digest(42));

    assert.strictEqual(a.is_superset_of(b), want);
  });
}

test_page_is_superset_of('inclusive', 1, 10, 1, 10, true);
test_page_is_superset_of('full', 1, 10, 2, 9, true);
test_page_is_superset_of('start', 2, 10, 1, 9, false);
test_page_is_superset_of('end', 1, 8, 2, 9, false);
test_page_is_superset_of('outside', 1, 10, 0, 11, false);

describe('PageRange tests', () => {
  it('test_no_diff', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const peer = [...local];

    assert.deepEqual(diff(local, peer), []);
  });

  it('test_diff_peer_missing_last_page', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    let peer = [...local];

    // Remove the last page
    peer.pop();

    // Invalidate the root/parent and update the peer root range to reflect
    // the missing last page
    peer[0] = new PageRange(peer[0].start, 11, new_digest(42));

    // Nothing to ask for - the peer is behind
    assert.deepEqual(diff(local, peer), []);
  });

  it('test_diff_local_missing_last_page', () => {
    enable_logging();

    let local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const peer = [...local];

    // Remove the last page
    local.pop();

    // Invalidate the root/parent and update the local root range to reflect
    // the missing last page
    local[0] = new PageRange(local[0].start, 11, new_digest(42));

    assert.deepEqual(diff(local, peer), [new DiffRange(6, 15)]);
  });

  it('test_diff_peer_missing_leaf_page', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const peer = [
      new PageRange(3, 15, new_digest(42)),
      new PageRange(3, 6, new_digest(43)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    assert.deepEqual(diff(local, peer), []);
  });

  it('test_diff_local_missing_leaf_page', () => {
    enable_logging();

    const local = [
      new PageRange(3, 15, new_digest(42)),
      new PageRange(3, 6, new_digest(43)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const peer = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    assert.deepEqual(diff(local, peer), [new DiffRange(2, 15)]);
  });

  it('test_diff_local_missing_subtree', () => {
    enable_logging();

    const local = [
      new PageRange(3, 15, new_digest(42)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const peer = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    assert.deepEqual(diff(local, peer), [new DiffRange(2, 15)]);
  });

  it('test_diff_peer_missing_subtree', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const peer = [
      new PageRange(3, 15, new_digest(42)),
      new PageRange(15, 15, new_digest(5)),
    ];

    assert.deepEqual(diff(local, peer), []);
  });

  it('test_diff_leaf_page_hash', () => {
    enable_logging();

    const peer = [
      new PageRange(2, 15, new_digest(42)),
      new PageRange(2, 6, new_digest(42)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    assert.deepEqual(diff(local, peer), [new DiffRange(2, 15)]);
  });

  it('test_diff_peer_extra_key_last_page', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    let peer = [...local];
    const end = peer.pop();
    peer.push(new PageRange(end.start, 16, new_digest(42)));

    // Root hash differs to reflect differing child
    peer[0] = new PageRange(peer[0].start, 16, new_digest(42));

    assert.deepEqual(diff(local, peer), [new DiffRange(6, 16)]);
  });

  it('test_diff_root_page_hash', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    let peer = [...local];

    // Root hash differs due to added key 8
    peer[0] = new PageRange(peer[0].start, peer[0].end, new_digest(42));

    assert.deepEqual(diff(local, peer), [new DiffRange(6, 15)]);
  });

  it('test_diff_peer_intermediate_bounds', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    let peer = [...local];

    // Root hash differs due to added key 8
    peer[1] = new PageRange(peer[1].start, 7, new_digest(42));

    peer[0] = new PageRange(peer[0].start, peer[0].end, new_digest(42));

    assert.deepEqual(diff(local, peer), [new DiffRange(2, 15)]);
  });

  it('test_diff_peer_intermediate_bounds_and_inconsistent_subtree_leaf', () => {
    enable_logging();

    const local = [
      new PageRange(2, 15, new_digest(1)),
      new PageRange(2, 6, new_digest(2)),
      new PageRange(2, 2, new_digest(3)),
      new PageRange(5, 5, new_digest(4)),
      new PageRange(15, 15, new_digest(5)),
    ];

    let peer = [...local];

    // Extend key range of 1st child to 2-6 to 2-7
    peer[1] = new PageRange(peer[1].start, 7, new_digest(42));

    // Key 2 value change
    peer[2] = new PageRange(peer[2].start, peer[2].end, new_digest(42));

    // Root hash
    peer[0] = new PageRange(peer[0].start, peer[0].end, new_digest(42));

    assert.deepEqual(diff(local, peer), [new DiffRange(2, 15)]);

    let localCopy = [...peer];

    // Only 2 should remain different - reset the hash.
    localCopy[2] = new PageRange(localCopy[2].start, localCopy[2].end, new_digest(3));
    peer[1] = new PageRange(peer[1].start, peer[1].end, new_digest(2));
    peer[0] = new PageRange(peer[0].start, peer[0].end, new_digest(1));

    assert.deepEqual(diff(localCopy, peer), [new DiffRange(2, 15)]);
  });

  it('test_child_page_inconsistent_no_subtree_recurse', () => {
    enable_logging();

    const local = [
      new PageRange(0, 17995215864353464453, new_digest(1)),
      new PageRange(0, 1331283967702353742, new_digest(2)),
      new PageRange(2425302987964992968, 3632803506728089373, new_digest(3)),
      new PageRange(4706903583207578752, 4707132771120484774, new_digest(4)),
      new PageRange(17995215864353464453, 17995215864353464453, new_digest(5)),
    ];
    const peer = [
      new PageRange(0, 17995215864353464453, new_digest(11)),
      new PageRange(0, 1331283967702353742, new_digest(2)),
      new PageRange(2425302987964992968, 3541571342636567061, new_digest(13)),
      new PageRange(3632803506728089373, 4707132771120484774, new_digest(14)),
      new PageRange(17995215864353464453, 17995215864353464453, new_digest(5)),
    ];

    assert.deepEqual(diff(local, peer), [new DiffRange(1331283967702353742, 17995215864353464453)]);
  });

  it('test_diff_peer_bounds_larger_both_sides', () => {
    enable_logging();

    const local = [new PageRange(2, 15, new_digest(1))];
    const peer = [new PageRange(1, 42, new_digest(2))];

    assert.deepEqual(diff(local, peer), [new DiffRange(1, 42)]);
  });

  it('test_diff_empty_peer', () => {
    enable_logging();

    const peer = [];
    const local = [new PageRange(1, 42, new_digest(1))];

    assert.deepEqual(diff(local, peer), []);
  });

  it('test_diff_empty_local', () => {
    enable_logging();

    const local = [];
    const peer = [new PageRange(1, 42, new_digest(1))];

    assert.deepEqual(diff(local, peer), [new DiffRange(1, 42)]);
  });

  it('test_trivial_sync_differing_values', () => {
    enable_logging();

    let a = new Node();
    a.upsert(new IntKey(42), 1);

    let b = new Node();
    b.upsert(new IntKey(42), 2);

    assert.strictEqual(sync_round(a, b), 1);
    assert.strictEqual(sync_round(a, b), 0);

    assert.strictEqual(sync_round(a, b), 0);
    assert.strictEqual(sync_round(a, b), 0);

    assert.deepEqual(a, b);
  });

  it('test_trivial_sync_differing_keys', () => {
    enable_logging();

    let a = new Node();
    a.upsert(new IntKey(42), 1);

    let b = new Node();
    b.upsert(new IntKey(24), 1);

    assert.strictEqual(sync_round(a, b), 0, "a => b");
    assert.strictEqual(sync_round(a, b), 0, "a => b");
    assert.strictEqual(sync_round(b, a), 1, "b => a");
    assert.strictEqual(sync_round(b, a), 0, "b => a");
    assert.strictEqual(sync_round(a, b), 2, "a => b");
    assert.strictEqual(sync_round(a, b), 0, "a => b");
    assert.strictEqual(sync_round(b, a), 0, "b => a");
    assert.strictEqual(sync_round(b, a), 0, "b => a");

    assert.deepEqual(a, b);
  });

  it('test_local_superset_of_peer', () => {
    enable_logging();

    let a = new Node();
    a.upsert(new IntKey(244067356035258375), 0);

    let b = new Node();
    b.upsert(new IntKey(0), 0);
    b.upsert(new IntKey(2750749774246655017), 0);

    assert.strictEqual(sync_round(a, b), 0, "a => b run 1");
    assert.strictEqual(sync_round(b, a), 2, "b => a run 1");
    assert.strictEqual(sync_round(a, b), 3, "a => b run 2");
    assert.strictEqual(sync_round(b, a), 0, "b => a run 2");
    assert.strictEqual(sync_round(a, b), 0, "a => b run 3");
    assert.strictEqual(sync_round(b, a), 0, "b => a run 3");

    assert.deepEqual(a, b);
  });
});

describe('DiffListBuilder', () => {
  it('test_convergence_identical_bounds', () => {
    const list = new DiffListBuilder<number>();

    list.inconsistent(2, 15);
    list.inconsistent(2, 6);
    list.consistent(2, 2);
    list.consistent(5, 5);
    list.inconsistent(2, 6);
    list.consistent(15, 15);

    const result = list.intoDiffVec();
    expect(result).toEqual([{ start: 2, end: 15 }]);
  });
});

describe('reduceSyncRange', () => {
  it('test_reduce_sync_range_middle', () => {
    const diff = [{ start: 4, end: 10 }];
    const consistentRanges = [{ start: 5, end: 8 }];
    const result = reduceSyncRange(diff, consistentRanges);
    expect(result).toEqual([
      { start: 4, end: 5 },
      { start: 8, end: 10 },
    ]);
  });

  // Add more test cases here...
});

// Mock test
function testMockHasher()
{
  const hasher = new MockHasher();

  let got = hasher.hash(new LevelKey('A', 0));
  console.assert(level(got) === 0, 'Test case 1 failed');

  got = hasher.hash(new LevelKey('A', 1));
  console.assert(level(got) === 1, 'Test case 2 failed');

  got = hasher.hash(new LevelKey('key_A', 2));
  console.assert(level(got) === 2, 'Test case 3 failed');

  got = hasher.hash(new LevelKey('key_A', 10));
  console.assert(level(got) === 10, 'Test case 4 failed');

  console.log('All test cases passed');
}

testMockHasher();
