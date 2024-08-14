import { Digest } from "./trait"

export class LevelKey<T>
{
  constructor(private key: T, private level: number)
  {
  }

  toString(): string
  {
    return this.key.toString();
  }
}

export class MockHasher
{
  hash(value: LevelKey<any>|string): Digest
  {
    if (value instanceof LevelKey)
    {
      const level = value.level;
      const iter  = Array(Math.floor(level / 2)).fill(0);

      let v: number[] = level % 2 === 1 ? [...iter, 0xF0] : iter;

      v = v.concat(Array(32 - v.length).fill(1));
      return new Digest(new Uint8Array(v));
    }
    else if (typeof value === 'string')
    {
      let v = new TextEncoder().encode(value);
      if (v.length > 32)
      {
        throw new Error('mock hash value is more than 32 bytes');
      }
      v = new Uint8Array([...v, ...Array(32 - v.length).fill(1)]);
      return new Digest(v);
    }
    throw new Error('Unsupported input type');
  }
}

export function level(digest: Digest): number
{
  let level = 0;
  for (const byte of digest.bytes)
  {
    if (byte === 0)
    {
      level += 2;
    }
    else if (byte === 0xF0)
    {
      level += 1;
      break;
    }
    else
    {
      break;
    }
  }
  return level;
}

