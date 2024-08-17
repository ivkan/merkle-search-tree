import { Digest } from './digest';

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
  private readonly value: Digest;

  constructor(value: PageDigest)
  {
    this.value = value.value;
  }

  valueOf(): Digest
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
  value: Digest;

  static new(value: Uint8Array): PageDigest
  {
    return new PageDigest(value);
  }

  constructor(value: Uint8Array = new Uint8Array())
  {
    this.value = new Digest(value);
  }

  valueOf(): Digest
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
export class ValueDigest
{
  private readonly value: Digest;

  static new(value: Digest): ValueDigest
  {
    return new ValueDigest(value);
  }

  constructor(value: Digest)
  {
    this.value = value;
  }

  clone(): ValueDigest
  {
    return new ValueDigest(this.value.clone());
  }

  valueOf(): Digest
  {
    return this.value;
  }

  toString(): string
  {
    return this.value.toString();
  }
}


