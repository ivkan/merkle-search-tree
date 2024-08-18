import { Digest, Hasher, SipHasher, RootHash, ValueDigest } from './digest';
import { InsertIntermediate, insertIntermediatePage, Page } from './page';
import { Node } from './node';
import { NodeIter } from './node-iter';
import { createHash, Hash } from 'crypto';
import { PageRangeHashVisitor, Visitor } from './visitor';
import { PageRange } from './diff';


export class MerkleSearchTree<K extends Number, V>
{
  hasher: Hasher;
  treeHasher: Hash;
  root: Page<K>;
  _rootHash: RootHash|null;

  constructor(hasher?: Hasher)
  {
    this.hasher     = hasher || new SipHasher();
    this.treeHasher = createHash('sha256');
    this.root       = new Page<K>(0, []);
    this._rootHash  = null;
  }

  static default<K extends Number, V>(): MerkleSearchTree<K, V>
  {
    return new MerkleSearchTree<K, V>();
  }

  rootHashCached(): RootHash|null
  {
    return this._rootHash;
  }

  inOrderTraversal<T extends Visitor<K>>(visitor: T): void
  {
    this.root.inOrderTraversal(visitor, false);
  }

  nodeIter(): NodeIter<K>
  {
    return new NodeIter<K>(this.root);
  }

  rootHash(): RootHash
  {
    this.root.maybeGenerateHash(this.treeHasher);
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
    this.root.inOrderTraversal(visitor, false);
    return visitor.finalise();
  }

  upsert(key: K, value: V): void
  {
    const valueHash = new ValueDigest(this.hasher.hash(value));
    const level     = Digest.level(this.hasher.hash(key));

    this.rootHash = null;

    const result = this.root.upsert(key, level, valueHash.clone());
    if (result instanceof InsertIntermediate && result.key === key)
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

