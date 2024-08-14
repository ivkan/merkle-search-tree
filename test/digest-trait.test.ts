// Tests
function test_asBytes() {
  const b = new Uint8Array([42, 42, 42, 42]);
  const d = Digest.new<4>(b);
  console.assert(b.every((value, index) => value === d.asBytes()[index]), "asBytes() should return the original bytes");
}

test_asBytes();
