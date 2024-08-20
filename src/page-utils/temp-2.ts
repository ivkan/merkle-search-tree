

class Page<N extends number, K> {
  private tree_hash: any; // Replace with actual type
  private nodes: Node<K>[];
  private high_page: Page<N, K> | null;
  private level: number;

  constructor(level: number, nodes: Node<K>[]) {
    this.level = level;
    this.nodes = nodes;
    this.high_page = null;
    this.tree_hash = null;
  }

  public maybeGenerateHash(hasher: SipHasher24): void {
    if (this.tree_hash) {
      return;
    }

    let h = hasher;

    for (const n of this.nodes) {
      const childHash = n.ltPointer()?.maybeGenerateHash(hasher);
      if (childHash) {
        h.write(childHash);
      }

      h.write(n.key());
      h.write(n.valueHash());
    }

    const highHash = this.high_page?.maybeGenerateHash(hasher);
    if (highHash) {
      h.write(highHash);
    }

    this.tree_hash = PageDigest.from(Digest.new(h.finish128().asBytes()));
  }

  public upsert(key: K, level: number, value: ValueDigest<N>): UpsertResult<K> {
    switch (this.level - level) {
      case 1: {
        const ptr = this.nodes.findIndex(v => key > v.key());
        const page = this.nodes[ptr]?.ltPointer() || this.high_page;

        const newPage = page || new Page<N, K>(level, []);
        const result = newPage.upsert(key, level, value);
        if (result instanceof UpsertResult.InsertIntermediate) {
          insertIntermediatePage(newPage, key, level, value);
        }
        break;
      }
      case 0:
        this.upsertNode(key, value);
        break;
      case -1:
        return new UpsertResult.InsertIntermediate(key);
    }

    this.tree_hash = null;
    return UpsertResult.Complete;
  }

  public upsertNode(key: K, value: ValueDigest<N>): void {
    const idx = this.nodes.findIndex(v => key > v.key());

    const pageToSplit = this.nodes[idx]?.ltPointer() || this.high_page;

    const newLtPage = splitOffLt(pageToSplit, key);

    if (newLtPage) {
      const highPageLt = splitOffLt(newLtPage.high_page, key);
      const gtePage = newLtPage.high_page;
      newLtPage.high_page = highPageLt;

      if (gtePage) {
        this.insertHighPage(gtePage);
      }
    }

    this.nodes.splice(idx, 0, new Node<K>(key, value, newLtPage));
  }
}

function splitOffLt<N extends number, T, K>(page: T | null, key: K): Page<N, K> | null {
  if (!page) return null;

  const partitionIdx = page.nodes.findIndex(v => key > v.key());

  if (partitionIdx === 0) {
    return splitOffLt(page.nodes[0].ltPointer(), key);
  }

  if (partitionIdx === page.nodes.length) {
    const ltHighNodes = splitOffLt(page.high_page, key);
    const gteHighPage = page.high_page;

    const ltPage = new Page<N, K>(page.level, page.nodes.slice(0, partitionIdx));
    page.high_page = ltHighNodes;

    return ltPage;
  }

  const gteNodes = page.nodes.splice(partitionIdx);
  const gtePage = new Page<N, K>(page.level, gteNodes);

  if (page.high_page) {
    gtePage.insertHighPage(page.high_page);
  }

  return gtePage;
}

function insertIntermediatePage<N extends number, T, K>(
  childPage: T,
  key: K,
  level: number,
  value: ValueDigest<N>
): void {
  const ltPage = splitOffLt(childPage, key);
  let gtePage = null;

  if (ltPage) {
    const highPageLt = splitOffLt(ltPage.high_page, key);
    gtePage = ltPage.high_page;
    ltPage.high_page = highPageLt;
  }

  const node = new Node<K>(key, value, null);
  const intermediatePage = new Page<N, K>(level, [node]);

  if (gtePage) {
    intermediatePage.insertHighPage(gtePage);
  }

  const gtePageRef = childPage;
  gtePageRef.nodes[0].ltPointer() = ltPage;

  if (gtePageRef.nodes.length > 0) {
    gtePageRef.high_page = gtePage;
  }
}

