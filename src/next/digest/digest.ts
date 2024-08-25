import { base64 } from '@scure/base';

/**
 * A variable bit length digest, output from a `Hasher` implementation.
 */
export class Digest<N extends number>
{
  static level = level;

  private digest: Uint8Array;

  constructor(digest: Uint8Array, length?: N)
  {
    if (length && digest.length !== length)
    {
      throw new Error(`Digest must be ${length} bytes long`);
    }
    this.digest = digest;
  }

  /**
   * Wrap an opaque byte array in a `Digest` for type safety.
   */
  static new<N extends number>(digest: Uint8Array): Digest<N>
  {
    return new Digest<N>(digest);
  }

  /**
   * Return a reference to a fixed size digest byte array.
   */
  asBytes(): Uint8Array
  {
    return this.digest;
  }

  toString(): string
  {
    return base64.encode(this.digest);
  }
}

/**
 * Extract the number of leading 0's when expressed as base 16 digits, defining
 * the tree level the hash should reside at.
 */
export function level<N extends number>(v: Digest<N>, base: number): number
{
  let out = 0;
  for (const byte of v.asBytes())
  {
    const zeroCount = baseCountZero(byte, base);
    if (zeroCount === 2)
    {
      out += 2;
    }
    else if (zeroCount === 1)
    {
      return out + 1;
    }
    else
    {
      return out;
    }
  }
  return out;
}

export function baseCountZero(v: number, base: number): number
{
  if (v === 0)
  {
    return 2;
  }

  if (v % base === 0)
  {
    return 1;
  }

  return 0;
}

