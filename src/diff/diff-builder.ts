import { debug } from "../tracing"

export interface DiffRange<K> {
  start: K
  end: K
}

export class RangeList<K> {
  // Placeholder for RangeList implementation
  insert(start: K, end: K): void {
    // Implementation details omitted
  }

  intoVec(): DiffRange<K>[] {
    // Implementation details omitted
    return []
  }
}

export class DiffListBuilder<K> {
  private _inconsistent: RangeList<K>
  private _consistent: RangeList<K>

  constructor() {
    this._inconsistent = new RangeList<K>()
    this._consistent = new RangeList<K>()
  }

  inconsistent(start: K, end: K): void {
    debug({ start, end }, "marking range inconsistent")
    this._inconsistent.insert(start, end)
  }

  consistent(start: K, end: K): void {
    debug({ start, end }, "marking range as consistent")
    this._consistent.insert(start, end)
  }

  intoDiffVec(): DiffRange<K>[] {
    return reduceSyncRange(
      this._inconsistent.intoVec(),
      this._consistent.intoVec(),
    )
  }
}

function reduceSyncRange<K>(
  badRanges: DiffRange<K>[],
  consistentRanges: DiffRange<K>[],
): DiffRange<K>[] {
  for (const good of consistentRanges) {
    badRanges = badRanges.flatMap((bad) => {
      if (!overlaps(good, bad)) {
        return [bad]
      }

      const out: DiffRange<K>[] = []

      if (bad.start < good.start) {
        out.push({ start: bad.start, end: good.start })
      }

      if (bad.end > good.end) {
        out.push({ start: good.end, end: bad.end })
      }

      return out
    })
  }

  // Merge overlapping ranges in the newly hole-punched ranges
  mergeOverlapping(badRanges)

  return badRanges
}

function overlaps<K>(a: DiffRange<K>, b: DiffRange<K>): boolean {
  // Implementation details omitted
  return false
}

function mergeOverlapping<K>(ranges: DiffRange<K>[]): void {
  // Implementation details omitted
}
