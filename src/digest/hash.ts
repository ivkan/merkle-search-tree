import { createHash } from "crypto";

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
export class SipHasher {
  private hasher: any

  constructor() {
    this.hasher = createHash("shake128")
  }

  // Initialise a SipHasher with the provided seed key.
  //
  // All peers comparing tree hashes MUST be initialised with the same seed
  // key.
  static new(key: Uint8Array): SipHasher {
    const hasher = new SipHasher()
    hasher.hasher.update(key)
    return hasher
  }

  hash<T>(value: T): Uint8Array {
    const h = this.hasher.copy()
    h.update(Buffer.from(JSON.stringify(value)))
    return h.digest().slice(0, 16)
  }
}

// // Digest type
// type Digest = Buffer
//
// // Hasher interface
// interface Hasher<T> {
//   hash(value: T): Digest
// }
//
// export { SipHasher, Digest, Hasher }
