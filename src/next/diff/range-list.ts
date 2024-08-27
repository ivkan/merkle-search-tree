import { DiffRange } from './diff-range';

/**
 * Helper to construct an ordered list of non-overlapping DiffRange intervals.
 */
export class RangeList<K>
{
  private syncRanges: DiffRange<K>[];

  constructor()
  {
    this.syncRanges = [];
  }

  /**
   * Insert the inclusive interval [start, end] into the list.
   */
  insert(start: K, end: K): void
  {
    if (start > end)
    {
      throw new Error('Start must be less than or equal to end');
    }
    this.syncRanges.push(new DiffRange( start, end ));
  }

  /**
   * Consume self and return the deduplicated/merged list of intervals
   * ordered by range start.
   */
  intoVec(): DiffRange<K>[]
  {
    this.syncRanges.sort((a, b) => this.compare(a.start, b.start));
    mergeOverlapping(this.syncRanges);

    // Check invariants in development builds.
    if (process.env.NODE_ENV === 'development')
    {
      for (let i = 0; i < this.syncRanges.length - 1; i++)
      {
        const current = this.syncRanges[i];
        const next    = this.syncRanges[i + 1];

        // Invariant: non-overlapping ranges
        if (this.overlaps(current, next))
        {
          throw new Error('Overlapping ranges detected');
        }

        // Invariant: end bound is always gte than start bound
        if (this.compare(current.start, current.end) > 0 || this.compare(next.start, next.end) > 0)
        {
          throw new Error('Diff range contains inverted bounds');
        }
      }
    }

    return this.syncRanges;
  }

  private compare(a: K, b: K): number
  {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  private overlaps(a: DiffRange<K>, b: DiffRange<K>): boolean
  {
    return this.compare(a.start, b.end) <= 0 && this.compare(b.start, a.end) <= 0;
  }
}

/**
 * Perform an in-place merge and deduplication of overlapping intervals.
 *
 * Assumes the intervals within `source` are sorted by the start value.
 */
export function mergeOverlapping<K>(source: DiffRange<K>[]): void
{
  if (source.length === 0) return;

  const result: DiffRange<K>[] = [source[0]];

  for (let i = 1; i < source.length; i++)
  {
    const range = source[i];
    const last  = result[result.length - 1];

    // Invariant: ranges are sorted by range start.
    if (range.start < last.start)
    {
      throw new Error('Ranges are not sorted by start value');
    }

    // Check if this range falls entirely within the existing range.
    if (range.end <= last.end)
    {
      // Skip this range that is a subset of the existing range.
      continue;
    }

    // Check for overlap across the end ranges (inclusive).
    if (range.start <= last.end)
    {
      // These two ranges overlap - extend the range in "last" to cover both.
      last.end = range.end;
    }
    else
    {
      result.push(range);
    }
  }

  // Replace the contents of source with the merged result
  source.length = 0;
  source.push(...result);
}

