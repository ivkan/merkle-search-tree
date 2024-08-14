import { BTreeMap } from 'collections';
import { MerkleSearchTree, PageRange } from './merkle-search-tree';

// An wrapper over integers, implementing `AsRef<[u8]>` with deterministic
// output across platforms with differing endian-ness.
class IntKey {
  private value: bigint;
  private bytes: Uint8Array;

  constructor(v: bigint) {
    this.value = v;
    this.bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      this.bytes[7 - i] = Number(v & 0xFFn);
      v >>= 8n;
    }
  }

  static new(v: bigint): IntKey {
    return new IntKey(v);
  }

  unwrap(): bigint {
    return this.value;
  }

  asRef(): Uint8Array {
    return this.bytes;
  }

  toString(): string {
    return this.value.toString();
  }
}

// A mock peer, storing `(key, value)` tuples and maintaining a
// `MerkleSearchTree` of the store contents.
class Node {
  private store: BTreeMap<IntKey, bigint>;
  private tree: MerkleSearchTree<IntKey, bigint>;

  constructor() {
    this.store = new BTreeMap<IntKey, bigint>();
    this.tree = new MerkleSearchTree<IntKey, bigint>();
  }

  // Store the given `key` & `value` in the node, replacing the previous
  // value of `key`, if any.
  upsert(key: IntKey, value: bigint): void {
    this.tree.upsert(key, value);
    this.store.set(key, value);
  }

  // Return a serialised representation of the `MerkleSearchTree` pages for
  // diff computations.
  pageRanges(): PageRange<IntKey>[] {
    this.tree.rootHash();
    return this.tree.serialisePageRanges();
  }

  // Return an iterator over the specified inclusive range of keys.
  *keyRangeIter(keyRange: [IntKey, IntKey]): IterableIterator<[IntKey, bigint]> {
    for (const [key, value] of this.store.entries()) {
      if (key >= keyRange[0] && key <= keyRange[1]) {
        yield [key, value];
      }
    }
  }

  keyCount(): number {
    return this.store.size;
  }

  // Implement methods from MerkleSearchTree
  rootHash(): Uint8Array {
    return this.tree.rootHash();
  }

  rootHashCached(): Uint8Array | undefined {
    return this.tree.rootHashCached();
  }
}

export { IntKey, Node };

