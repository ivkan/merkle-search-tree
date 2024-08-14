import { sha3_256, Keccak } from "@noble/hashes/sha3"
import { Digest, Hasher } from "./trait"
import { Hash } from "@noble/hashes/utils"
// import { FixedLengthArray } from "./types";
//
// /**
//  * A fast, non-cryptographic hash outputting 128-bit digests.
//  *
//  * This implementation is used as the default Hasher implementation, using
//  * the standard library Hash trait, which may produce non-portable hashes
//  * as described in the documentation of the Hash trait itself, and this
//  * crate's Hasher.
//  *
//  * Users may choose to initialise the SipHasher with seed keys if untrusted
//  * key/value user input is used in a tree in order to prevent chosen-hash
//  * collision attacks.
//  */
// export class SipHasher implements Hasher<16, any> {
//   private hasher: SipHasher24
//
//   constructor() {
//     this.hasher = new SipHasher24()
//   }
//
//   /**
//    * Initialise a SipHasher with the provided seed key.
//    *
//    * All peers comparing tree hashes MUST be initialised with the same seed
//    * key.
//    */
//   static new(key: Uint8Array|FixedLengthArray<number, 16>): SipHasher {
//     if (key.length !== 16) {
//       throw new Error("Key must be 16 bytes long")
//     }
//     const hasher = SipHasher24.newWithKey(key)
//     return new SipHasher(hasher)
//   }
//
//   hash<T>(value: T): Digest<16> {
//     const h = this.hasher.clone()
//     // Assuming there's a way to hash the value
//     h.update(Buffer.from(JSON.stringify(value)))
//     const result = h.digest()
//     return new Digest<16>(result, 16)
//   }
// }

export class SipHasher implements Hasher<16, Uint8Array> {
  private hasher: Hash<Keccak>

  constructor() {
    this.hasher = sha3_256.create()
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

  hash(value: Uint8Array): Digest<16> {
    const h = this.hasher.clone()
    h.update(Uint8Array.from(value))
    return new Digest(h.digest().slice(0, 16), 16)
  }
}
