import { RangeList, mergeOverlapping } from './range-list';
import { DiffRange } from './diff-range';

/**
 * Helper to construct an ordered, minimal list of non-overlapping
 * `DiffRange` from a set of inconsistent intervals, and a set of consistent
 * intervals.
 *
 * Range bounds are always inclusive.
 *
 * Precedence is given towards the consistent list - if a single identical
 * range is marked both inconsistent and consistent, is is treated as a
 * consistent range.
 */
export class DiffListBuilder<K>
{
  private _inconsistent: RangeList<K>;
  private _consistent: RangeList<K>;

  constructor()
  {
    this._inconsistent = new RangeList<K>();
    this._consistent   = new RangeList<K>();
  }

  /**
   * Mark the inclusive range from `[start, end]` as inconsistent.
   */
  inconsistent(start: K, end: K): void
  {
    console.log({ start, end }, 'marking range inconsistent');
    this._inconsistent.insert(start, end);
  }

  /**
   * Mark the inclusive range from `[start, end]` as consistent.
   */
  consistent(start: K, end: K): void
  {
    console.log({ start, end }, 'marking range as consistent');
    this._consistent.insert(start, end);
  }

  /**
   * Consume this builder and return the deduplicated, minimised list of
   * inconsistent ranges.
   */
  intoDiffVec(): DiffRange<K>[]
  {
    return reduceSyncRange(this._inconsistent.intoVec(), this._consistent.intoVec());
  }
}

export function reduceSyncRange<K>(
  badRanges: DiffRange<K>[],
  consistentRanges: DiffRange<K>[]
): DiffRange<K>[]
{
  // The output array of ranges that require syncing.
  //
  // This array should never contain any overlapping (before this call).

  for (const good of consistentRanges)
  {
    badRanges = badRanges.flatMap(bad =>
    {
      if (!overlaps(good, bad))
      {
        return [bad];
      }

      const out: DiffRange<K>[] = [];

      if (bad.start < good.start)
      {
        out.push({
          start: bad.start,
          end  : good.start
        });
      }

      if (bad.end > good.end)
      {
        out.push({
          start: good.end,
          end  : bad.end
        });
      }

      return out;
    });
  }

  // Merge overlapping ranges in the newly hole-punched ranges
  mergeOverlapping(badRanges);

  // Invariant: the output ranges contain no overlapping entries
  if (process.env.NODE_ENV === 'development')
  {
    for (let i = 0; i < badRanges.length - 1; i++)
    {
      console.assert(!overlaps(badRanges[i], badRanges[i + 1]));
    }
  }

  return badRanges;
}

export function overlaps<K>(a: DiffRange<K>, b: DiffRange<K>): boolean
{
  return a.start <= b.end && b.start <= a.end;
}
