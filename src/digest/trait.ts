import { base64 } from "@scure/base"
import { FixedLengthArray } from "./types"

/**
 * A hash function outputting a fixed-length digest of `N` bytes.
 *
 * The hash function must produce strong digests with a low probability of
 * collision. Use of a cryptographic hash function is not required, but may be
 * preferred for security/compliance reasons.
 *
 * Use of a faster hash function results in faster tree operations. Use of
 * 64bit hash values (`N <= 8`) and smaller is not recommended due to the
 * higher probability of collisions.
 *
 * # Determinism & Portability
 *
 * Implementations are required to be deterministic across all peers which
 * compare tree values.
 *
 * # Default Implementation
 *
 * The default `Hasher` implementation (`SipHasher`) outputs 128-bit/16
 * byte digests which are strong, but not of cryptographic quality.
 *
 * Users may choose to initialise the `SipHasher` with seed keys if untrusted
 * key/value user input is used in a tree in order to prevent chosen-hash
 * collision attacks.
 */
export interface Hasher<N extends number, T> {
  /**
   * Hash `T`, producing a unique, deterministic digest of `N` bytes length.
   */
  hash(value: T): Digest<N>
}

/**
 * A variable bit length digest, output from a `Hasher` implementation.
 */
export class Digest<N extends number> {
  private digest: Uint8Array

  constructor(digest: Uint8Array | FixedLengthArray<number, N>, length: N) {
    if (digest.length !== length) {
      throw new Error(`Digest must be ${length} bytes long`)
    }
    this.digest = new Uint8Array(digest)
  }

  /**
   * Wrap an opaque byte array in a `Digest` for type safety.
   */
  static new<N extends number>(
    digest: Uint8Array | FixedLengthArray<number, N>,
    length: N,
  ): Digest<N> {
    return new Digest<N>(digest, length)
  }

  /**
   * Return a reference to a fixed size digest byte array.
   */
  asBytes(): Uint8Array {
    return this.digest
  }

  toString(): string {
    return base64.encode(this.digest)
  }
}

/**
 * Extract the number of leading 0's when expressed as base 16 digits, defining
 * the tree level the hash should reside at.
 */
export function level<N extends number>(v: Digest<N>): number {
  let out = 0
  for (const byte of v.asBytes()) {
    const zeroPrefix = zeroPrefixLen(byte)
    if (zeroPrefix === 2) {
      out += 2
    } else if (zeroPrefix === 1) {
      return out + 1
    } else {
      return out
    }
  }
  return out
}

/**
 * Returns the number of consecutive zero characters when `v` is represented as
 * a base16 string (evaluated LSB to MSB).
 */
function zeroPrefixLen(v: number): number {
  // Implemented as a look-up table for fast calculation.
  switch (v) {
    case 0x00:
      return 2
    case 0x10:
    case 0x20:
    case 0x30:
    case 0x40:
    case 0x50:
    case 0x60:
    case 0x70:
    case 0x80:
    case 0x90:
    case 0xa0:
    case 0xb0:
    case 0xc0:
    case 0xd0:
    case 0xe0:
    case 0xf0:
      return 1
    default:
      return 0
  }
}
