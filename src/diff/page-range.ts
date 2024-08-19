import { PageDigest } from '../digest/wrappers';
import { Page } from '../page';

/**
 * A serialised representation of the range of keys contained within the
 * sub-tree rooted at a given `Page`, and the associated `PageDigest`.
 *
 * A `PageRange` contains all the information needed to perform a tree
 * difference calculation, used as the input to the `diff()` function.
 *
 * The contents of this type can be serialised and transmitted over the
 * network, and reconstructed by the receiver by calling `PageRange.new()`
 * with the serialised values.
 */
export class PageRange<K>
{
  private readonly start: K;
  private readonly end: K;
  private readonly hash: PageDigest;

  /**
   * Create a `PageRange` from a `Page`.
   */
  static fromPage<N extends number, K>(page: Page<N, K>): PageRange<K>
  {
    return new PageRange(
      page.minSubtreeKey(),
      page.maxSubtreeKey(),
      page.hash() ?? new PageDigest() // Assuming PageDigest has a default constructor
    );
  }

  /**
   * Construct a `PageRange` for the given key interval and `PageDigest`.
   *
   * @throws Error if `start` is greater than `end`.
   */
  constructor(start: K, end: K, hash: PageDigest)
  {
    if (start > end)
    {
      throw new Error('start must be less than or equal to end');
    }
    this.start = start;
    this.end   = end;
    this.hash  = hash;
  }

  /**
   * Returns the inclusive start of this `PageRange`.
   */
  getStart(): K
  {
    return this.start;
  }

  /**
   * Returns the inclusive end of this `PageRange`
   */
  getEnd(): K
  {
    return this.end;
  }

  /**
   * Returns true if `this` is a superset of `other` (not a strict superset -
   * equal ranges are treated as supersets of each other).
   */
  isSupersetOf(other: PageRange<K>): boolean
  {
    return this.start <= other.start && other.end <= this.end;
  }

  /**
   * Returns the `PageDigest` of this page, representing the content of the
   * page and all pages within the sub-tree rooted at it.
   */
  getHash(): PageDigest
  {
    return this.hash;
  }

  /**
   * Consume this `PageRange`, returning the `PageDigest` that covers the
   * subtree rooted at this page.
   */
  intoHash(): PageDigest
  {
    return this.hash;
  }

  toString(): string
  {
    return `(${this.start}, ${this.end})`;
  }

  clone(): PageRange<K>
  {
    return new PageRange(this.start, this.end, this.hash.clone());
  }
}

