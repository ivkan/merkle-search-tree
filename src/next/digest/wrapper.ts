import { Digest } from './digest';
import { equalBytes } from '../../utils/uint8array';

/**
 * The root hash of a `MerkleSearchTree`, representative of the state of the
 * tree.
 *
 * Two instances of a `MerkleSearchTree` are guaranteed to contain the same
 * state iff both `RootHash` read from the trees are identical (assuming
 * identical, deterministic `Hasher` implementations).
 */
export class RootHash
{
  private value: Digest<16>;

  constructor(value: PageDigest)
  {
    this.value = value.value;
  }

  valueOf(): Digest<16>
  {
    return this.value;
  }

  toString(): string
  {
    return this.value.toString();
  }
}


/**
 * Type wrapper over a `Digest` of a `Page`, representing the hash of the
 * nodes & subtree rooted at the `Page`.
 */
export class PageDigest
{
  value: Digest<16>;

  constructor(value: Uint8Array = new Uint8Array())
  {
    this.value = new Digest<16>(value);
  }

  static new(value: Uint8Array): PageDigest
  {
    return new PageDigest(value);
  }

  static from(value: Digest<16>): PageDigest
  {
    return new PageDigest(value.asBytes())
  }

  valueOf(): Digest<16>
  {
    return this.value;
  }

  toString(): string
  {
    return this.value.toString();
  }

  clone(): PageDigest
  {
    return new PageDigest(this.value.asBytes());
  }

  equals(other: PageDigest): boolean
  {
    return equalBytes(this.value.asBytes(), other.value.asBytes())
  }
}


/**
 * Type wrapper over a `Digest` of a tree value, for readability / clarity /
 * compile-time safety.
 */
export class ValueDigest<N extends number>
{
  private value: Digest<N>;

  constructor(value: Digest<N>)
  {
    this.value = value;
  }

  static new<N extends number>(value: Digest<N>): ValueDigest<N>
  {
    return new ValueDigest<N>(value);
  }

  valueOf(): Digest<N>
  {
    return this.value;
  }

  toString(): string
  {
    return this.value.toString();
  }

  clone(): ValueDigest<N>
  {
    return ValueDigest.new(this.value);
  }
}

