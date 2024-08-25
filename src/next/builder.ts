import { Hasher, SipHasher } from './digest';
import { DEFAULT_LEVEL_BASE, MerkleSearchTree } from './tree';

/**
 * A `MerkleSearchTree` builder to initialise trees with custom parameters.
 */
export class Builder<H extends Hasher<N>, N extends number = 16>
{
  private readonly hasher: H;
  private readonly levelBase: number;

  constructor(hasher: H, levelBase: number = DEFAULT_LEVEL_BASE)
  {
    this.hasher    = hasher;
    this.levelBase = levelBase;
  }

  /**
   * Use the provided `Hasher` to compute key and value digests.
   */
  withHasher<T extends Hasher<N>>(hasher: T): Builder<T>
  {
    return new Builder(hasher, this.levelBase);
  }

  /**
   * Configure the value for the parameter `B` as described in the paper (the
   * branching factor).
   *
   * Decreasing this value increases the height of the tree, which increases
   * the number of pages, and therefore decreases the average page size.
   */
  withLevelBase(b: number): Builder<H>
  {
    return new Builder(this.hasher, b);
  }

  build<K, V, N extends number = 16>(): MerkleSearchTree<K, V, N>
  {
    return new MerkleSearchTree<K, V, N>(this.hasher, this.levelBase);
  }
}

export function createDefaultBuilder(): Builder<Hasher<16>>
{
  return new Builder(new SipHasher());
}
