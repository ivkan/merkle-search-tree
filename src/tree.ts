import { SipHasher } from './digest/siphash';
import { insertIntermediatePage, Page } from './page';
import { Node } from './node';
import { RootHash, ValueDigest } from './digest/wrappers';
import { NodeIter } from './node-iter';
import { PageRange } from './diff/page-range';
import { Digest } from './digest/digest';
import { createHash, Hash } from 'crypto';
import { Visitor } from './visitor/visitor';
import { PageRangeHashVisitor } from './visitor/page-range-hash-visitor';


type DefaultHasher = SipHasher;

export class MerkleSearchTree<K, V, H = DefaultHasher>
{
  hasher: H;
  treeHasher: Hash;
  root: Page<K>;
  _rootHash: RootHash|null;

  constructor(hasher?: H)
  {
    this.hasher     = hasher || new SipHasher() as H;
    this.treeHasher = createHash('sha256');
    this.root       = new Page<K>(0, []);
    this._rootHash  = null;
  }

  static default<K, V>(): MerkleSearchTree<K, V>
  {
    return new MerkleSearchTree<K, V>();
  }

  rootHashCached(): RootHash|null
  {
    return this._rootHash;
  }

  inOrderTraversal<T extends Visitor<K>>(visitor: T): void
  {
    this.root.in_order_traversal(visitor, false);
  }

  nodeIter(): NodeIter<K>
  {
    return new NodeIter<K>(this.root);
  }

  rootHash(): RootHash
  {
    this.root.maybe_generate_hash(this.treeHasher);
    const rootPageDigest = this.root.hash()?.clone();
    this._rootHash       = !!rootPageDigest ? new RootHash(rootPageDigest) : null;

    if (this.rootHash)
    {
      console.debug('regenerated root hash', this.rootHash);
    }

    if (!this.rootHash)
    {
      throw new Error('Root hash is not available');
    }

    return this._rootHash;
  }

  serialisePageRanges(): PageRange<K>[]|null
  {
    if (!this.rootHashCached())
    {
      return null;
    }

    if (this.root.nodes.length === 0)
    {
      return [];
    }

    const visitor = new PageRangeHashVisitor<K>();
    this.root.in_order_traversal(visitor, false);
    return visitor.finalise();
  }

  upsert(key: K, value: V): void
  {
    const valueHash = new ValueDigest(this.hasher.hash(value));
    const level     = Digest.level(this.hasher.hash(key));

    this.rootHash = null;

    const result = this.root.upsert(key, level, valueHash.clone());
    if (result instanceof UpsertResult.InsertIntermediate)
    {
      if (this.root.nodes.length === 0)
      {
        const node = new Node(key, valueHash, null);
        this.root  = new Page<K>(level, [node]);
        return;
      }

      insertIntermediatePage(this.root, key, level, valueHash);
    }
  }
}

