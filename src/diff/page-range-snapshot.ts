import { PageRange } from "./page-range"
import { PageDigest } from "../digest/wrappers"

/**
 * An owned point-in-time snapshot of the `PageRange` returned from a call to
 * `MerkleSearchTree.serialisePageRanges()`.
 *
 * Generating a `PageRangeSnapshot` from a set of `PageRange` instances
 * clones all the bounding keys in each `PageRange`, and therefore can only
 * be generated if the key type `K` implements `Clone`.
 *
 * ```typescript
 * let t = new MerkleSearchTree();
 * t.upsert("bananas", 42);
 *
 * // Rehash the tree before generating the page ranges
 * t.rootHash();
 *
 * // Generate the hashes & page ranges, immutably borrowing the tree
 * let ranges = t.serialisePageRanges();
 *
 * // Obtain an owned PageRangeSnapshot from the borrowed PageRange, in turn
 * // releasing the immutable reference to the tree.
 * let snap = PageRangeSnapshot.from(ranges);
 *
 * // The tree is now mutable again.
 * t.upsert("platanos", 42);
 * ```
 *
 * A `PageRangeSnapshot` can also be generated from owned key values using
 * the `OwnedPageRange` type to eliminate clones where unnecessary.
 */
export class PageRangeSnapshot<K>
{
  private ranges: OwnedPageRange<K>[]

  constructor(ranges: OwnedPageRange<K>[])
  {
    this.ranges = ranges
  }

  /**
   * Return an iterator of `PageRange` from the snapshot content.
   */
  * iter(): IterableIterator<PageRange<K>>
  {
    for (const v of this.ranges)
    {
      yield new PageRange(v.start, v.end, v.hash.clone())
    }
  }

  static from<K>(value: PageRange<K>[]): PageRangeSnapshot<K>
  {
    return new PageRangeSnapshot(value.map(v => OwnedPageRange.from(v)))
  }

  static fromOwned<K>(value: OwnedPageRange<K>[]): PageRangeSnapshot<K>
  {
    return new PageRangeSnapshot(value)
  }
}

/**
 * An owned representation of a `PageRange` containing an owned key interval
 * & page hash.
 *
 * This type can be used to construct a `PageRangeSnapshot` from owned values
 * (eliminating key/hash clones).
 */
export class OwnedPageRange<K>
{
  constructor(
    public start: K,
    public end: K,
    public hash: PageDigest,
  )
  {
    if (start > end)
    {
      throw new Error("start must be less than or equal to end")
    }
  }

  static from<K>(v: PageRange<K>): OwnedPageRange<K>
  {
    return new OwnedPageRange(
      v.getStart(),
      v.getEnd(),
      v.intoHash(),
    )
  }
}


