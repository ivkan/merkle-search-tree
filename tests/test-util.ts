import { PageRange, MerkleSearchTree } from '../src';

// An wrapper over integers, implementing `AsRef<[u8]>` with deterministic
// output across platforms with differing endian-ness.
export class IntKey extends Number
{
  readonly value: bigint;
  private readonly bytes: Uint8Array;

  constructor(v: bigint|number)
  {
    super(v);
    let bigintValue = BigInt(v);
    this.value = bigintValue;
    this.bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++)
    {
      this.bytes[7 - i] = Number(bigintValue & 0xFFn);
      bigintValue >>= 8n;
    }
  }

  static new(v: bigint): IntKey
  {
    return new IntKey(v);
  }

  unwrap(): bigint
  {
    return this.value;
  }

  asRef(): Uint8Array
  {
    return this.bytes;
  }

  asNumber(): number
  {
    return Number(this.value);
  }

  toString(): string
  {
    return this.value.toString();
  }
}

// A mock peer, storing `(key, value)` tuples and maintaining a
// `MerkleSearchTree` of the store contents.
export class Node
{
  private readonly store: Map<IntKey, bigint>;
  private tree: MerkleSearchTree<IntKey, bigint>;

  constructor()
  {
    this.store = new Map<IntKey, bigint>();
    this.tree  = new MerkleSearchTree<IntKey, bigint>();
  }

  upsert(key: IntKey, value: bigint): void
  {
    this.tree.upsert(key, value);
    this.store.set(key, value);
  }

  pageRanges(): PageRange<IntKey>[]
  {
    this.tree.rootHash();
    return this.tree.serialisePageRanges();
  }

  // keyRangeIter(keyRange: [IntKey, IntKey]): IterableIterator<[IntKey, bigint]> {
  //   return this.store.range(keyRange[0], keyRange[1]);
  // }
  // Return an iterator over the specified inclusive range of keys.
  * keyRangeIter(
    keyRange: [IntKey, IntKey],
  ): IterableIterator<[IntKey, bigint]>
  {
    for (const [key, value] of this.store.entries())
    {
      if (key >= keyRange[0] && key <= keyRange[1])
      {
        yield [key, value]
      }
    }
  }

  keyCount(): number
  {
    return this.store.size;
  }

  [Symbol.iterator](): IterableIterator<[IntKey, bigint]>
  {
    return this.store[Symbol.iterator]();
  }
}


