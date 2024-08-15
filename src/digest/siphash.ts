import { sha256 } from "@noble/hashes/sha256";
import { Hash } from "@noble/hashes/utils";
import { Digest, Hasher } from "./trait";

export class SipHasher implements Hasher<16, Uint8Array> {
  private hasher: Hash<any>

  constructor() {
    this.hasher = sha256.create()
  }

  // Initialise a SipHasher with the provided seed key.
  //
  // All peers comparing tree hashes MUST be initialised with the same seed
  // key.
  static new(key: Uint8Array | string): SipHasher {
    const hasher = new SipHasher()
    hasher.hasher.update(key)
    return hasher
  }

  hash(value: Uint8Array | string): Digest<16> {
    const h = this.hasher.clone()
    h.update(value)
    return new Digest(h.digest().slice(0, 16), 16)
  }

  write(value: Uint8Array | string): void {
    this.hasher.update(value)
  }

  asBytes(): Uint8Array {
    return this.hasher.digest().slice(0, 16);
  }
}
