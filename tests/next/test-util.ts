import { MerkleSearchTree, PageRange, RootHash } from '../../src/next';

export class TestNode
{
  private store: Map<number, bigint>;
  private tree: MerkleSearchTree<number, bigint>;

  constructor()
  {
    this.store = new Map<number, bigint>();
    this.tree  = new MerkleSearchTree<number, bigint>();
  }

  upsert(key: number, value: bigint): void
  {
    this.tree.upsert(key, value);
    this.store.set(key, value);
  }

  pageRanges(): PageRange<number>[]
  {
    this.tree.rootHash();
    return this.tree.serialisePageRanges();
  }

  * keyRangeIter(
    keyRange: [number, number],
  ): IterableIterator<[number, number]>
  {
    for (const [key, value] of this.store.entries())
    {
      if (key >= keyRange[0] && key <= keyRange[1])
      {
        yield [key, Number(value)]
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
