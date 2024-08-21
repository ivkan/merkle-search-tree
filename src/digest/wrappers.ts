import { Digest } from './digest';

/**
 * The root hash of a `MerkleSearchTree`, representative of the state of the
 * tree.
 *
 * Two instances of a `MerkleSearchTree` are guaranteed to contain the same
 * state if both `RootHash` read from the trees are identical (assuming
 * identical, deterministic `Hasher` implementations).
 */
export class RootHash
{
  readonly value: Digest<16>;

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
export class PageDigest implements RootHash
{
  readonly value: Digest<16>;

  constructor(value: Uint8Array = new Uint8Array())
  {
    this.value = new Digest(value, 16);
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
}

/**
 * Type wrapper over a `Digest` of a tree value, for readability / clarity /
 * compile-time safety.
 */
export class ValueDigest<N extends number>
{
  private readonly value: Digest<N>;

  constructor(value: Digest<N>)
  {
    this.value = value;
  }

  clone(): ValueDigest<N>
  {
    return new ValueDigest(this.value.clone());
  }

  valueOf(): Digest<N>
  {
    return this.value;
  }

  toString(): string
  {
    return this.value.toString();
  }
}


