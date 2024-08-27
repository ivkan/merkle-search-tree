import { Digest, MerkleSearchTree, PageRange, RootHash } from '../../src/next';

export class TestNode
{
  store: Map<number, number>;
  tree: MerkleSearchTree<number, number>;

  constructor()
  {
    this.store = new Map<number, number>();
    this.tree  = new MerkleSearchTree<number, number>();
  }

  // clone(): TestNode
  // {
  //   const node = new TestNode();
  //
  //   node.store = new Map(this.store);
  //   node.tree  = Object.assign(new MerkleSearchTree(), this.tree); // this.tree;
  //
  //   return node;
  // }

  /**
   * Store the given `key` & `value` in the node, replacing the previous
   * value of `key`, if any.
   */
  upsert(key: number, value: bigint|number): void
  {
    this.tree.upsert(key, Number(value));
    this.store.set(key, Number(value));
  }

  /**
   * Return a serialised representation of the [`MerkleSearchTree`] pages for
   * diff computations.
   */
  pageRanges(): PageRange<number>[]
  {
    this.tree.rootHash();
    return this.tree.serialisePageRanges();
  }

  /**
   * Return an iterator over the specified inclusive range of keys.
   */
  * keyRangeIter(
    keyRange: [number, number],
  ): IterableIterator<[number, number]>
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

  rootHash(): RootHash
  {
    return this.tree.rootHash();
  }

  rootHashCached(): RootHash
  {
    return this.tree.rootHashCached();
  }
}

export class LevelKey<T>
{
  constructor(public key: T, public level: number)
  {
  }

  toString(): string
  {
    return this.key.toString()
  }
}

export class MockHasher
{
  hash(value: any): Digest<16>
  {
    if (value instanceof LevelKey)
    {
      const level = value.level
      const iter  = Array(Math.floor(level / 2)).fill(0)

      let v: number[] = level % 2 === 1 ? [...iter, 0xf0] : iter

      v = v.concat(Array(32 - v.length).fill(1))
      return new Digest(new Uint8Array(v), new Uint8Array(v).length)
    }
    else if (typeof value === 'string')
    {
      let v = new TextEncoder().encode(value)
      if (v.length > 32)
      {
        throw new Error('mock hash value is more than 32 bytes')
      }
      v = new Uint8Array([...v, ...Array(32 - v.length).fill(1)])
      return new Digest(v, v.length)
    }
    throw new Error('Unsupported input type')
  }
}

/*export class MockHasher implements Hasher<32> {
  hash(value: LevelKey<any>): Digest<32> {
    const level = value['level'];
    const iter = Array(Math.floor(level / 2)).fill(0);

    let v: number[] = level % 2 === 1 ? [...iter, 0xF0] : iter;

    v = v.concat(Array(32 - v.length).fill(1));
    return new Digest<32>(new Uint8Array(v));
  }

  hashStr(value: string): Digest<32> {
    let v = new TextEncoder().encode(value);
    if (v.length > 32) {
      throw new Error("mock hash value is more than 32 bytes");
    }

    v = new Uint8Array([...v, ...Array(32 - v.length).fill(1)]);
    return new Digest<32>(v);
  }
}*/
