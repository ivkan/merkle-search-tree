import { Digest } from "../src/digest/trait"
import { PageDigest, ValueDigest } from "../src/digest/wrappers"

describe("Digest classes", () => {
  if (process.env.FEATURE_DIGEST_BASE64) {
    test("base64 format", () => {
      const d = new Digest([0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a])
      expect(d.toString()).toBe("YmFuYW5hcwo=")

      const value = new ValueDigest(
        new Digest([0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a]),
      )
      expect(value.toString()).toBe("YmFuYW5hcwo=")

      const page = PageDigest.from(
        new Digest([
          0x62, 0x61, 0x6e, 0x61, 0x6e, 0x61, 0x73, 0x0a, 0x62, 0x61, 0x6e,
          0x61, 0x6e, 0x61, 0x73, 0x0a,
        ]),
      )
      expect(page.toString()).toBe("YmFuYW5hcwpiYW5hbmFzCg==")
    })
  }

  test("as bytes", () => {
    const b = [42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42]
    const d = PageDigest.from(
      new Digest(
        b as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ],
      ),
    )
    expect(d.valueOf().valueOf()).toEqual(b)
  })
})
