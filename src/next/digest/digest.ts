import { base64 } from '@scure/base';

/**
 * A variable bit length digest, output from a `Hasher` implementation.
 */
export class Digest<N extends number>
{
  static level = level;

  /**
   * Extract the number of leading 0's when expressed as base 16 digits, defining
   * the tree level the hash should reside at.
   */
  /*static level<N extends number>(v: Digest<N>): number
  {
    let out = 0;
    for (const byte of v.asBytes())
    {
      const zeroPrefix = zeroPrefixLen(byte);
      if (zeroPrefix === 2)
      {
        out += 2;
      }
      else if (zeroPrefix === 1)
      {
        return out + 1;
      }
      else
      {
        return out;
      }
    }
    return out;
  }*/

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

function baseCountZero(v: number, base: number): number
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

/**
 * Returns the number of consecutive zero characters when `v` is represented as
 * a base16 string (evaluated LSB to MSB).
 */
/*function zeroPrefixLen(v: number): number
{
  // Implemented as a look-up table for fast calculation.
  switch (v)
  {
    case 0x00:
      return 2;
    case 0x10:
    case 0x20:
    case 0x30:
    case 0x40:
    case 0x50:
    case 0x60:
    case 0x70:
    case 0x80:
    case 0x90:
    case 0xA0:
    case 0xB0:
    case 0xC0:
    case 0xD0:
    case 0xE0:
    case 0xF0:
      return 1;
    default:
      return 0;
  }
}*/
