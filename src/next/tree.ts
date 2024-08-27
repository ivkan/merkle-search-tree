import { Digest, Hasher, HasherInput, RootHash, SipHasher, ValueDigest } from './digest';
import { insertIntermediatePage, Page, UpsertResult } from './page';
import { Node } from './node';
import { PageRangeHashVisitor, Visitor } from './visitor';
import { NodeIter } from './node-iter';
import { PageRange } from './diff/page-range';
import { debug } from './tracing';

export const DEFAULT_LEVEL_BASE: number = 16;

export class MerkleSearchTree<K extends HasherInput, V extends HasherInput, N extends number = 16>
{
  hasher: Hasher<N>;
  treeHasher: SipHasher;
  root: Page<N, K>;
  _rootHash: RootHash|null;
  levelBase: number;
  _valueType: V;

  constructor(
    hasher: Hasher<N> = new SipHasher(),
    levelBase: number = DEFAULT_LEVEL_BASE
  )
  {
    this.hasher     = hasher;
    this.levelBase  = levelBase;
    this.treeHasher = new SipHasher();
    this.root       = new Page<N, K>(0, []);
    this._rootHash  = null;
    this._valueType = {} as V;
  }

  static newWithHasher<K, V, N extends number = 16>(hasher: Hasher<N>): MerkleSearchTree<K, V, N>
  {
    const instance  = new MerkleSearchTree<K, V, N>();
    instance.hasher = hasher;
    return instance;
  }

  rootHashCached(): RootHash|null
  {
    return this._rootHash;
  }

  inOrderTraversal<T extends Visitor<N, K>>(visitor: T): void
  {
    this.root.inOrderTraversal(visitor, false);
  }

  nodeIter(): NodeIter<N, K>
  {
    return new NodeIter<N, K>(this.root);
  }

  rootHash(): RootHash
  {
    // this.root.maybeGenerateHash(this.treeHasher);
    // this._rootHash = new RootHash(this.root.hash()?.clone());
    //
    // debug('regenerated root hash', {
    //   root_hash: this._rootHash.valueOf().toString()
    // })
    //
    // return this._rootHash!;
    this.root.maybeGenerateHash(this.treeHasher);
    const rootPageDigest = this.root.hash()?.clone();
    this._rootHash       = !!rootPageDigest ? new RootHash(rootPageDigest) : null;

    debug(`regenerated root hash: ${this._rootHash}`);

    return this._rootHash!;
  }

  serialisePageRanges(): PageRange<K>[]|null
  {
    // if (!this.rootHashCached())
    // {
    //   return null;
    // }
    //
    // if (this.root.nodes.length === 0)
    // {
    //   return [];
    // }
    //
    // const visitor = new PageRangeHashVisitor<N, K>();
    // this.root.inOrderTraversal(visitor, false);
    // return visitor.finalise();
    if (!this.rootHashCached())
    {
      return null;
    }

    if (this.root.nodes.length === 0)
    {
      return [];
    }

    const visitor = new PageRangeHashVisitor<N, K>();
    this.root.inOrderTraversal(visitor, false);
    return visitor.finalise();
  }

  /**
   * Add or update the value for `key`.
   *
   * This method invalidates the cached, precomputed root hash value, if any
   * (even if the value is not modified).
   *
   * # Value Hash
   *
   * The tree stores a the hashed representation of `value` - the actual
   * value is not stored in the tree.
   */
  upsert(key: K, value: V): void
  {
    const valueHash = new ValueDigest(this.hasher.hash(value));
    const level     = Digest.level(this.hasher.hash(key), this.levelBase);

    // Invalidate the root hash - it always changes when a key is upserted.
    this._rootHash = null;

    const result = this.root.upsert(key, level, valueHash);
    if (result === UpsertResult.InsertIntermediate)
    {
      if (this.root.nodes.length === 0)
      {
        const node = new Node(key, valueHash, null);
        this.root  = new Page<N, K>(level, [node]);
        return;
      }

      insertIntermediatePage(this.root, key, level, valueHash);
    }
  }

 /* upsert(key: K, value: V): void
  {
    const valueHash = new ValueDigest(this.hasher.hash(value));
    const level     = Digest.level(this.hasher.hash(key));

    // Invalidate the root hash - it always changes when a key is upserted.
    this._rootHash = null;

    const upsertResult = this.root.upsert(key, level, valueHash);
    if (upsertResult === UpsertResult.InsertIntermediate)
    {
      // As an optimisation and simplification, if the current root is
      // empty, simply replace it with the new root.
      if (this.root.nodes.length === 0)
      {
        const node = new Node(key, valueHash, null);
        this.root  = new Page(level, [node]);
        return;
      }

      insertIntermediatePage(this.root, key, level, valueHash);
    }
  }*/
}


