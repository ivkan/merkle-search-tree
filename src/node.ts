import { Page } from './page';
import { ValueDigest } from './digest';
import { Visitor } from './visitor';

/**
 * Storage of a single key/value pair.
 *
 * Keys are stored immutably in the Node, alongside the hash of a value
 * (and not the value itself).
 */
export class Node<N extends number, K>
{
  private readonly key: K;
  private valueHash: ValueDigest;
  private ltPointer: Page<N, K>|null;

  constructor(key: K, value: ValueDigest, ltPointer: Page<N, K>|null = null)
  {
    this.key       = key;
    this.valueHash = value;
    this.ltPointer = ltPointer;
  }

  depthFirst<T extends Visitor<N, K>>(visitor: T): boolean
  {
    if (!visitor.preVisitNode(this))
    {
      return false;
    }

    if (this.ltPointer)
    {
      if (!this.ltPointer.inOrderTraversal(visitor, false))
      {
        return false;
      }
    }

    if (!visitor.visitNode(this))
    {
      return false;
    }

    if (!visitor.postVisitNode(this))
    {
      return false;
    }

    return true;
  }

  /**
   * Return the key of this node.
   */
  getKey(): K
  {
    return this.key;
  }

  /**
   * Return the hash of the value for this node.
   */
  getValueHash(): ValueDigest
  {
    return this.valueHash;
  }

  updateValueHash(hash: ValueDigest): void
  {
    this.valueHash = hash;
  }

  getLtPointer(): Page<N, K>|null
  {
    return this.ltPointer;
  }

  getLtPointerMut(): Page<N, K>|null
  {
    return this.ltPointer;
  }

  setLtPointer(pointer: Page<N, K>|null): void
  {
    this.ltPointer = pointer;
  }
}

