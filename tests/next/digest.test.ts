import { baseCountZero, DEFAULT_LEVEL_BASE, Digest, level, PageDigest, ValueDigest } from '../../src/next';

describe('Digest tests', () =>
{
  test('as_bytes', () =>
  {
    const b = new Uint8Array([42, 42, 42, 42]);
    const d = new Digest(b);
    expect(d.asBytes()).toEqual(b);
  });

  test('compatibility_b16', () =>
  {
    function oldAlgorithm(v: number): number
    {
      switch (v)
      {
        case 0x00:
          return 2;
        case 0x10:
        case 0x30:
        case 0x20:
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
    }

    for (let i = 0; i <= 255; i++)
    {
      expect(oldAlgorithm(i)).toBe(baseCountZero(i, 16));
    }
  });

  test('prefix_lens', () =>
  {
    let got = level(new Digest(new Uint8Array([0x00, 0x00, 0x00, 0x11])), DEFAULT_LEVEL_BASE);
    expect(got).toBe(6);

    got = level(new Digest(new Uint8Array([0x11, 0x00, 0x00, 0x00])), DEFAULT_LEVEL_BASE);
    expect(got).toBe(0);

    // Stops after the first non-zero value
    got = level(new Digest(new Uint8Array([0x00, 0x10, 0x00, 0x11])), DEFAULT_LEVEL_BASE);
    expect(got).toBe(3);

    // Matches the base
    got = level(new Digest(new Uint8Array([0x00, 16])), DEFAULT_LEVEL_BASE);
    expect(got).toBe(3);

    // Wrap-around the base
    got = level(new Digest(new Uint8Array([0x00, 17])), DEFAULT_LEVEL_BASE);
    expect(got).toBe(2);
  });

  test('base64 format', () =>
  {
    const d = new Digest(new Uint8Array([0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a]));
    expect(d.toString()).toBe('YmFuYW5hcwo=');

    const value = new ValueDigest(new Digest(new Uint8Array([0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a])));
    expect(value.toString()).toBe('YmFuYW5hcwo=');

    const page = PageDigest.from(new Digest(new Uint8Array([
      0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a,
      0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a
    ])));
    expect(page.toString()).toBe('YmFuYW5hcwpiYW5hbmFzCg==');
  });

  test('PageDigest as bytes', () =>
  {
    const b = new Uint8Array([
      42, 42, 42, 42, 42, 42, 42, 42,
      42, 42, 42, 42, 42, 42, 42, 42
    ]);
    const d = PageDigest.from(new Digest(b));
    expect(new Uint8Array(d.value.asBytes())).toEqual(b);
  });
});

