// import { Keccak, shake128 } from '@noble/hashes/sha3';
// import { HashXOF } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256'
import { Digest } from './digest';
import { isUint8Array } from '../../utils/uint8array';
import { Hash } from '@noble/hashes/utils';

export interface HasherInputStringify
{
  toString(): string;
}

export type HasherInput = Uint8Array|string|number|HasherInputStringify;

// A default Hasher implementation backed by SipHasher24

// A fast, non-cryptographic hash outputting 128-bit digests.
//
// This implementation is used as the default Hasher implementation, using
// the standard library Hash trait, which may produce non-portable hashes
// as described in the documentation of the Hash trait itself, and this
// crate's Hasher.
//
// Users may choose to initialise the SipHasher with seed keys if untrusted
// key/value user input is used in a tree in order to prevent chosen-hash
// collision attacks.

export class SipHasher implements Hasher<16>
{
  private hasher: Hash<any>; // HashXOF<HashXOF<Keccak>>;

  constructor()
  {
    this.hasher = sha256.create(); // shake128.create({ dkLen: 16 });
  }

  // Initialise a SipHasher with the provided seed key.
  //
  // All peers comparing tree hashes MUST be initialised with the same seed
  // key.
  static new(key: Uint8Array): SipHasher
  {
    const hasher = new SipHasher();
    hasher.hasher.update(key);
    return hasher;
  }

  hash<T extends HasherInput>(value: T): Digest<16>
  {
    const h = this.hasher.clone();
    h.update(convertHashInput(value)); // Buffer.from(JSON.stringify(value))
    return new Digest(h.digest());
  }

  write<T extends HasherInput>(value: T): void
  {
    this.hasher.update(convertHashInput(value));
  }

  clone(): SipHasher
  {
    return SipHasher.new(this.digest())
  }

  digest(): Uint8Array
  {
    return this.hasher.clone().digest();
  }
}

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
 * compare tree values. Notably the standard library `Hash` derive does not
 * produce portable hashes across differing platforms, endian-ness or Rust
 * compiler versions.
 *
 * # Default Implementation
 *
 * The default `Hasher` implementation (`SipHasher`) outputs 128-bit/16
 * byte digests which are strong, but not of cryptographic quality.
 *
 * `SipHasher` uses the standard library `Hash` trait, which may produce
 * non-portable hashes as described above (and in the `Hash` documentation).
 *
 * Users may choose to initialise the `SipHasher` with seed keys if untrusted
 * key/value user input is used in a tree in order to prevent chosen-hash
 * collision attacks.
 *
 * The provided `SipHasher` implementation is not portable across platforms /
 * Rust versions due to limitations of the `Hash` trait.
 */
export interface Hasher<N extends number>
{
  // hash<T>(value: T): Uint8Array;
  hash<T extends HasherInput>(value: T): Digest<N>;
  clone?(): Hasher<N>;
  write?<T extends HasherInput>(value: T): void;
  // update?(value: HasherInput): Hash<any>;
  digest?(): Uint8Array;
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
