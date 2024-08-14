import { Digest } from "./trait"
import { FixedLengthArray } from "./types"

/**
 * The root hash of a `MerkleSearchTree`, representative of the state of the
 * tree.
 *
 * Two instances of a `MerkleSearchTree` are guaranteed to contain the same
 * state iff both `RootHash` read from the trees are identical (assuming
 * identical, deterministic `Hasher` implementations).
 */
export class RootHash {
  private value: Digest<16>

  constructor(value: PageDigest) {
    this.value = value.value
  }

  valueOf(): Digest<16> {
    return this.value
  }
}

/**
 * Type wrapper over a `Digest` of a `Page`, representing the hash of the
 * nodes & subtree rooted at the `Page`.
 */
export class PageDigest {
  value: Digest<16>

  constructor(value: FixedLengthArray<number, 16> | Uint8Array) {
    this.value = new Digest(value, value.length)
  }

  valueOf(): Digest<16> {
    return this.value
  }

  static from(value: Digest<16>): PageDigest {
    return new PageDigest(value.valueOf() as FixedLengthArray<number, 16>)
  }
}

/**
 * Type wrapper over a `Digest` of a tree value, for readability / clarity /
 * compile-time safety.
 */
export class ValueDigest<N extends number> {
  private value: Digest<N>

  constructor(value: Digest<N>) {
    this.value = value
  }

  valueOf(): Digest<N> {
    return this.value
  }
}

// Conditional implementation for base64 formatting
/*if (process.env.FEATURE_DIGEST_BASE64) {
  RootHash.prototype.toString = function () {
    return this.value.toString()
  }

  PageDigest.prototype.toString = function () {
    return this.value.toString()
  }

  ValueDigest.prototype.toString = function () {
    return this.value.toString()
  }
}*/

