import { Hash } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'
import { Digest } from './digest';
import { isUint8Array } from '../utils/is-uint8array';

export interface HasherInputStringify
{
  toString(): string;
}

export type HasherInput = Uint8Array|string|number|HasherInputStringify;

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
export interface Hasher<N extends number>
{
  /**
   * Hash `T`, producing a unique, deterministic digest of `N` bytes length.
   */
  hash(value: HasherInput): Digest<N>
}

// A fast, non-cryptographic hash outputting 128-bit digests.
export class SipHasher<N extends number = 16> implements Hasher<N>
{
  private hasher: Hash<any>;

  constructor(outputLen = 16)
  {
    this.hasher           = sha256.create();
    this.hasher.outputLen = outputLen;
  }

  hash(value: HasherInput): Digest<16>
  {
    const hash = this.hasher.clone();
    hash.update(convertHashInput(value));
    const result = hash.digest();

    return new Digest(result);
  }
}

function convertHashInput(value: HasherInput): string|Uint8Array
{
  if (isUint8Array(value) || typeof value === 'string')
  {
    return value;
  }
  else if (typeof value?.toString === 'function')
  {
    return value.toString();
  }
}

