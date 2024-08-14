import { DiffRange } from "./diff-builder"

/**
 * Helper to construct an ordered list of non-overlapping DiffRange intervals.
 */
export class RangeList<K> {
  private syncRanges: DiffRange<K>[]

  constructor() {
    this.syncRanges = []
  }

  /**
   * Insert the inclusive interval [start, end] into the list.
   */
  insert(start: K, end: K): void {
    if (start > end) {
      throw new Error("Start must be less than or equal to end")
    }
    this.syncRanges.push({ start, end })
  }

  /**
   * Consume self and return the deduplicated/merged list of intervals
   * ordered by range start.
   */
  intoVec(): DiffRange<K>[] {
    this.syncRanges.sort((a, b) =>
      a.start < b.start ? -1 : a.start > b.start ? 1 : 0,
    )
    mergeOverlapping(this.syncRanges)

    // Check invariants in development builds.
    if (process.env.NODE_ENV === "development") {
      for (let i = 0; i < this.syncRanges.length - 1; i++) {
        const current = this.syncRanges[i]
        const next = this.syncRanges[i + 1]

        // Invariant: non-overlapping ranges
        if (overlaps(current, next)) {
          throw new Error("Overlapping ranges detected")
        }

        // Invariant: end bound is always gte than start bound
        if (current.start > current.end || next.start > next.end) {
          throw new Error("Diff range contains inverted bounds")
        }
      }
    }

    return this.syncRanges
  }
}

/**
 * Perform an in-place merge and deduplication of overlapping intervals.
 * Assumes the intervals within `source` are sorted by the start value.
 */
function mergeOverlapping<K>(source: DiffRange<K>[]): void {
  if (source.length === 0) return

  const result: DiffRange<K>[] = [source[0]]

  for (let i = 1; i < source.length; i++) {
    const current = source[i]
    const merged = result[result.length - 1]

    // Check if this range falls entirely within the existing range.
    if (current.start >= merged.start && current.end <= merged.end) {
      // Skip this range that is a subset of the existing range.
      continue
    }

    // Check for overlap across the inclusive ranges.
    if (current.start <= merged.end) {
      // These two ranges overlap - extend the range in the merged output.
      merged.end = current.end
    } else {
      result.push(current)
    }
  }

  // Replace the contents of source with the merged result
  source.length = 0
  source.push(...result)
}

function overlaps<K>(a: DiffRange<K>, b: DiffRange<K>): boolean {
  return a.start <= b.end && b.start <= a.end
}
