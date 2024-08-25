import { DiffListBuilder, DiffRange, reduceSyncRange } from '../../src/next';

describe('DiffListBuilder and reduceSyncRange', () =>
{
  test('convergence_identical_bounds', () =>
  {
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

  const testReduceSyncRange = (
    name: string,
    diff: DiffRange<number>[],
    consistentRanges: DiffRange<number>[],
    want: DiffRange<number>[]
  ) =>
  {
    test(`reduce_sync_range_${name}`, () =>
    {
      const got = reduceSyncRange(diff, consistentRanges);
      expect(got).toEqual(want);
    });
  };

  testReduceSyncRange(
    'middle',
    [{ start: 4, end: 10 }],
    [{ start: 5, end: 8 }],
    [
      { start: 4, end: 5 },
      { start: 8, end: 10 },
    ]
  );

  testReduceSyncRange(
    'right_edge',
    [{ start: 4, end: 10 }],
    [{ start: 5, end: 10 }],
    [{ start: 4, end: 5 }]
  );

  testReduceSyncRange(
    'left_edge',
    [{ start: 4, end: 10 }],
    [{ start: 4, end: 8 }],
    [{ start: 8, end: 10 }]
  );

  testReduceSyncRange(
    'double_overlap',
    [{ start: 4, end: 10 }],
    [
      { start: 4, end: 6 },
      { start: 6, end: 8 },
    ],
    [{ start: 8, end: 10 }]
  );

  testReduceSyncRange(
    'complete_subtree_consistency',
    [{ start: 4, end: 10 }],
    [
      { start: 4, end: 6 },
      { start: 6, end: 10 },
    ],
    []
  );
});
