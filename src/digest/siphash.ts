import { createHash, Hash } from 'crypto';
import { Digest } from './digest';

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
export interface Hasher<T>
{
  /**
   * Hash `T`, producing a unique, deterministic digest of `N` bytes length.
   */
  hash(value: T): Digest;
}

// A fast, non-cryptographic hash outputting 128-bit digests.
export class SipHasher implements Hasher<any>
{
  private hasher: Hash;

  static new(key: Uint8Array): SipHasher
  {
    return new SipHasher(key);
  }

  constructor(key?: Uint8Array)
  {
    if (key && key.length === 16)
    {
      // In TypeScript, we'll use a simple hash function as an example
      // You might want to use a more sophisticated hashing algorithm in practice
      this.hasher = createHash('sha256');
      this.hasher.update(key);
    }
    else
    {
      this.hasher = createHash('sha256');
    }
  }

  hash(value: any): Digest
  {
    const hash = this.hasher.copy();
    hash.update(JSON.stringify(value));
    const result = hash.digest().slice(0, 16);

    return new Digest(result);
  }
}


