import { Digest, Hasher, SipHasher, RootHash, ValueDigest } from './digest';
import { InsertIntermediate, insertIntermediatePage, Page } from './page';
import { Node } from './node';
import { NodeIter } from './node-iter';
import { createHash, Hash } from 'crypto';
import { PageRangeHashVisitor, Visitor } from './visitor';
import { PageRange } from './diff';

/**
 * An implementation of the Merkle Search Tree as described in [Merkle Search
 * Trees: Efficient State-Based CRDTs in Open Networks][paper].
 *
 * This implementation stores only keys directly in the tree - hashes of values
 * are retained instead of the actual value. This allows greatest flexibility,
 * as the user can choose the most appropriate key/value storage data
 * structure, while using the MST strictly for anti-entropy / Merkle proofs.
 *
 * # Merkle Search Trees
 *
 * In addition to the normal hash & consistency properties of a regular
 * Merkle/hash tree, a MST is a searchable balanced B-tree with variable,
 * probabilistically bounded page sizes and a deterministic representation
 * irrespective of insert order - these properties make a MST a useful data
 * structure for efficient state-based CRDT replication and anti-entropy.
 *
 * Keys are stored in sort order (from min to max) in an MST. If monotonic keys
 * are inserted, a minimal amount of hash re-computation needs to be performed
 * as the nodes & pages for most of the older keys remain unchanged; this
 * reduces the overhead of anti-entropy as fewer intermediate hashes need
 * recomputing and exchanging during reconciliation.
 *
 * # Portability & Compatibility
 *
 * For two `MerkleSearchTree` to be useful, both instances must produce
 * identical hash digests for a given input. To do so, they must be using the
 * same `Hasher` implementation, and in turn it must output a deterministic
 * hash across all peers interacting with the `MerkleSearchTree`.
 *
 * For ease of use, this library uses the Node.js crypto module by default to
 * hash key and value types. If you intend to interact with peers across
 * multiple platforms, you should consider implementing a fully-deterministic
 * `Hasher` specialised to your key/value types.
 *
 * Any change to the underlying hash construction algorithm implemented in this
 * class that would cause existing hashes to no longer match will not occur
 * without a breaking change major semver version bump once this class reaches
 * stability (>=1.0.0).
 *
 * # Lazy Tree Hash Generation
 *
 * Each page within the tree maintains a cache of the pre-computed hash of
 * itself, and the sub-tree rooted from it (all pages & nodes below it).
 * Successive root hash queries will re-use this cached value to avoid hashing
 * the full tree each time.
 *
 * Upserting elements into the tree invalidates the cached hashes of the pages
 * along the path to the leaf, and the leaf page itself. To amortise the cost
 * of regenerating these hashes, the affected pages are marked as "dirty",
 * causing them to be rehashed next time the root hash is requested. This
 * allows hash regeneration to occur once per batch of upsert operations.
 *
 * # Example
 *
 * ```typescript
 * const t = new MerkleSearchTree<string, string>();
 * t.upsert("bananas", "great");
 * t.upsert("plátano", "muy bien");
 *
 * // Obtain a root hash / merkle proof covering all the tree data
 * const hash1 = t.rootHash();
 * console.log(hash1);
 *
 * // Modify the MST, reflecting the new value of an existing key
 * t.upsert("bananas", "amazing");
 *
 * // Obtain an updated root hash
 * const hash2 = t.rootHash();
 * console.log(hash2);
 *
 * // The root hash changes to reflect the changed state
 * expect(hash1).not.toEqual(hash2);
 * ```
 *
 * [paper]: https://inria.hal.science/hal-02303490
 */
export class MerkleSearchTree<K, V, N extends number = 16>
{
  hasher: Hasher;
  treeHasher: Hash;
  root: Page<N, K>;
  _rootHash: RootHash|null;

  constructor(hasher?: Hasher)
  {
    this.hasher     = hasher || new SipHasher();
    this.treeHasher = createHash('sha256');
    this.root       = new Page<N, K>(0, []);
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

    const visitor = new PageRangeHashVisitor<N, K>();
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
        this.root  = new Page<N, K>(level, [node]);
        return;
      }

      insertIntermediatePage(this.root, key, level, valueHash);
    }
  }
}

