import { diff, DiffRange, PageDigest, PageRange } from '../src';

function newDigest(lsb: number): PageDigest
{
  return new PageDigest(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, lsb]));
}

function test_page_is_superset_of(
  name: string,
  a_start: number,
  a_end: number,
  b_start: number,
  b_end: number,
  want: boolean
)
{
  it(`test_page_is_superset_of_${name}`, () =>
  {
    const a = new PageRange(a_start, a_end, newDigest(42));
    const b = new PageRange(b_start, b_end, newDigest(42));

    expect(a.isSupersetOf(b)).toEqual(want);
  });
}

describe('PageRange tests', () =>
{
  test_page_is_superset_of('inclusive', 1, 10, 1, 10, true);
  test_page_is_superset_of('full', 1, 10, 2, 9, true);
  test_page_is_superset_of('start', 2, 10, 1, 9, false);
  test_page_is_superset_of('end', 1, 8, 2, 9, false);
  test_page_is_superset_of('outside', 1, 10, 0, 11, false);

  it('test_no_diff', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    const peer = [...local];

    const diffResult = diff(local, peer);

    console.log('diffResult', diffResult);

    expect(diffResult.length === 0).toBeTruthy();
  });

  it('test_diff_peer_missing_last_page', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];

    // Remove the last page
    peer.pop();

    // Invalidate the root/parent and update the peer root range to reflect
    // the missing last page
    peer[0] = new PageRange(peer[0].getStart(), 11, newDigest(42));

    // Nothing to ask for - the peer is behind
    expect(diff(local, peer).length === 0);
  });

  it('test_diff_local_missing_last_page', () =>
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
    local[0] = new PageRange(local[0].getStart(), 11, newDigest(42));

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(6, 15)];
    expect(result1).toEqual(result2);
  });

  it('test_diff_peer_missing_leaf_page', () =>
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

    expect(diff(local, peer).length === 0).toBeTruthy();
  });

  it('test_diff_local_missing_leaf_page', () =>
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

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(2, 15)];

    expect(result1).toEqual(result2);
  });

  it('test_diff_local_missing_subtree', () =>
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

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(2, 15)];
    expect(result1).toEqual(result2);
  });

  it('test_diff_peer_missing_subtree', () =>
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

    expect(diff(local, peer).length === 0).toBeTruthy();
  });

  it('test_diff_leaf_page_hash', () =>
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

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(2, 15)];
    expect(result1).toEqual(result2);
  });

  it('test_diff_peer_extra_key_last_page', () =>
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
    peer.push(new PageRange(end.getStart(), 16, newDigest(42)));

    // Root hash differs to reflect differing child
    peer[0] = new PageRange(peer[0].getStart(), 16, newDigest(42));

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(6, 16)];
    expect(result1).toEqual(result2);
  });

  it('test_diff_root_page_hash', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];

    // Root hash differs due to added key 8
    peer[0] = new PageRange(peer[0].getStart(), peer[0].getEnd(), newDigest(42));

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(6, 15)];
    expect(result1).toEqual(result2);
  });

  it('test_diff_peer_intermediate_bounds', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];

    // Root hash differs due to added key 8
    peer[1] = new PageRange(peer[1].getStart(), 7, newDigest(42));

    peer[0] = new PageRange(peer[0].getStart(), peer[0].getEnd(), newDigest(42));

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(5, 15)];
    expect(result1).toEqual(result2);
  });

  it('test_diff_peer_intermediate_bounds_and_inconsistent_subtree_leaf', () =>
  {
    const local = [
      new PageRange(2, 15, newDigest(1)),
      new PageRange(2, 6, newDigest(2)),
      new PageRange(2, 2, newDigest(3)),
      new PageRange(5, 5, newDigest(4)),
      new PageRange(15, 15, newDigest(5)),
    ];

    let peer = [...local];

    // Extend key range of 1st child to 2-6 to 2-7
    peer[1] = new PageRange(peer[1].getStart(), 7, newDigest(42));

    // Key 2 value change
    peer[2] = new PageRange(peer[2].getStart(), peer[2].getEnd(), newDigest(42));

    // Root hash
    peer[0] = new PageRange(peer[0].getStart(), peer[0].getEnd(), newDigest(42));

    const result1 = diff(local, peer);
    const result2 = [new DiffRange(5, 15)];
    expect(result1).toEqual(result2);

    let localCopy = [...peer];

    // Only 2 should remain different - reset the hash.
    localCopy[2] = new PageRange(localCopy[2].getStart(), localCopy[2].getEnd(), newDigest(3));
    peer[1]      = new PageRange(peer[1].getStart(), peer[1].getEnd(), newDigest(2));
    peer[0]      = new PageRange(peer[0].getStart(), peer[0].getEnd(), newDigest(1));

    const resultCopy1 = diff(localCopy, peer);
    const resultCopy2 = [new DiffRange(5, 15)];
    expect(resultCopy1).toEqual(resultCopy2);
  });
});


