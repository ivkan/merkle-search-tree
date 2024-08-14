import { BTreeSet, HashSet } from 'typescript-collections';
import { SipHasher24 } from 'siphash';
import { MerkleSearchTree, Digest, IntKey, LevelKey, MockHasher, InvariantAssertCount, InvariantAssertOrder, NopVisitor } from './your-module';

// A hash implementation that does not rely on the stdlib Hash trait, and
// therefore produces stable hashes across rust version changes /
// platforms.
class FixtureHasher {
  hash(value: IntKey): Digest<16> {
    return this.hash(value.unwrap());
  }

  hash(value: number): Digest<16> {
    let h = new SipHasher24();
    h.write(value);
    return Digest.from(h.finish128().asBytes());
  }
}

describe('MerkleSearchTree Tests', () => {
  test('test_hash_fixture', () => {
    let t = new MerkleSearchTree(new FixtureHasher());

    for (let i = 0; i < 1000; i++) {
      t.upsert(new IntKey(i), i);
    }

    // This hash ensures that any changes to this construction do not result
    // in existing hashes being invalidated / unequal for the same data.
    let fixture_hash = [
      57, 77, 199, 66, 89, 217, 207, 166, 136, 181, 45, 80, 108, 80, 94, 3,
    ];

    expect(t.root_hash().asRef()).toEqual(fixture_hash);
  });

  test('test_level_generation', () => {
    let h = Digest.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Digest.level(h)).toBe(32);

    let h = Digest.from([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Digest.level(h)).toBe(0);

    let h = Digest.from([0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Digest.level(h)).toBe(1);

    let h = Digest.from([0, 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Digest.level(h)).toBe(3);
  });

  function test_insert(name: string, values: [LevelKey, any][]) {
    test(`test_${name}`, () => {
      let t = new MerkleSearchTree(new MockHasher());

      values.forEach(([key, value]) => {
        t.upsert(key, value);
      });

      assert_tree(t);
    });
  }

  test_insert('one', [
    [new LevelKey('key', 0), 'bananas']
  ]);

  test_insert('one_non_zero_level', [
    [new LevelKey('key', 4), 'bananas']
  ]);

  test_insert('two_in_order', [
    [new LevelKey('A', 0), 'bananas'],
    [new LevelKey('B', 0), 'bananas']
  ]);

  test_insert('two_unordered', [
    [new LevelKey('B', 0), 'bananas'],
    [new LevelKey('A', 0), 'bananas']
  ]);

  test_insert('root_split_page_gt', [
    [new LevelKey('A', 0), 'bananas'],
    [new LevelKey('B', 1), 'bananas']
  ]);

  test_insert('root_split_page_lt', [
    [new LevelKey('B', 0), 'bananas'],
    [new LevelKey('A', 1), 'bananas']
  ]);

  test_insert('root_split_non_zero_step_gt', [
    [new LevelKey('A', 3), 'bananas'],
    [new LevelKey('B', 9), 'bananas']
  ]);

  test_insert('root_split_non_zero_step_lt', [
    [new LevelKey('B', 3), 'bananas'],
    [new LevelKey('A', 9), 'bananas']
  ]);

  test_insert('non_root_page_split_gt', [
    [new LevelKey('A', 6), 'bananas'],
    [new LevelKey('B', 4), 'bananas'],
    [new LevelKey('C', 2), 'bananas']
  ]);

  test_insert('non_root_page_split_lt', [
    [new LevelKey('C', 6), 'bananas'],
    [new LevelKey('B', 4), 'bananas'],
    [new LevelKey('A', 2), 'bananas']
  ]);

  test_insert('update', [
    [new LevelKey('A', 6), 'bananas'],
    [new LevelKey('A', 6), 'platanos']
  ]);

  test_insert('split_child_into_two_empty_gte_page', [
    [new LevelKey('A', 5), 'platanos'],
    [new LevelKey('B', 0), 'platanos'],
    [new LevelKey('C', 0), 'platanos'],
    [new LevelKey('D', 1), 'platanos']
  ]);

  test_insert('split_child_into_two_with_gte_page', [
    [new LevelKey('A', 5), 'platanos'],
    [new LevelKey('B', 0), 'platanos'],
    [new LevelKey('C', 0), 'platanos'],
    [new LevelKey('E', 0), 'platanos'],
    [new LevelKey('D', 1), 'platanos']
  ]);

  test_insert('greatest_key_splits_high_page', [
    [new LevelKey(11, 1), 'bananas'],
    [new LevelKey(10, 2), 'bananas'],
    [new LevelKey(12, 2), 'bananas']
  ]);

  test_insert('intermediate_page_move_all_nodes_and_high_page', [
    [new LevelKey(1, 1), 'bananas'],
    [new LevelKey(2, 1), 'bananas'],
    [new LevelKey(4, 0), 'bananas'],
    [new LevelKey(3, 2), 'bananas']
  ]);

  test_insert('intermediate_page_move_all_nodes_and_high_page_subset', [
    [new LevelKey(1, 1), 'bananas'],
    [new LevelKey(2, 1), 'bananas'],
    [new LevelKey(3, 0), 'bananas'],
    [new LevelKey(5, 0), 'bananas'],
    [new LevelKey(4, 2), 'bananas']
  ]);

  test_insert('child_page_split_add_intermediate', [
    [new LevelKey('K', 2), 'bananas'],
    [new LevelKey('D', 0), 'bananas'],
    [new LevelKey('E', 1), 'bananas']
  ]);

  test_insert('equal_page_move_all_nodes_and_high_page', [
    [new LevelKey(2, 64), 'bananas'],
    [new LevelKey(5, 20), 'bananas'],
    [new LevelKey(3, 52), 'bananas'],
    [new LevelKey(4, 64), 'bananas']
  ]);

  test_insert('equal_page_move_all_nodes_and_high_page_subset', [
    [new LevelKey(2, 64), 'bananas'],
    [new LevelKey(6, 20), 'bananas'],
    [new LevelKey(4, 20), 'bananas'],
    [new LevelKey(3, 52), 'bananas'],
    [new LevelKey(5, 64), 'bananas']
  ]);

  test_insert('split_page_all_gte_nodes_with_lt_pointer', [
    [new LevelKey(1, 0), 'bananas'],
    [new LevelKey(0, 1), 'bananas']
  ]);

  test_insert('split_page_all_lt_nodes_with_high_page', [
    [new LevelKey(0, 0), 'bananas'],
    [new LevelKey(1, 1), 'bananas']
  ]);

  test_insert('insert_intermediate_recursive_lt_pointer', [
    [new LevelKey(1, 1), ''],
    [new LevelKey(2, 0), ''],
    [new LevelKey(4, 1), ''],
    [new LevelKey(3, 2), '']
  ]);

  test_insert('split_page_move_gte_lt_pointer_to_high_page', [
    [new LevelKey(1, 1), ''],
    [new LevelKey(2, 0), ''],
    [new LevelKey(4, 1), ''],
    [new LevelKey(3, 2), '']
  ]);

  test_insert('split_page_move_input_high_page_to_gte_page', [
    [new LevelKey(6, 0), 'bananas'],
    [new LevelKey(3, 21), 'bananas'],
    [new LevelKey(0, 21), 'bananas'],
    [new LevelKey(1, 22), 'bananas']
  ]);

  describe('proptest', () => {
    test('prop_deterministic_construction', () => {
      // keys is a HashSet of (keys, level), which will iterate in random
      // order.
      //
      // Collect the items into a vector and sort it, producing a
      // different insert ordering from the HashSet iter.
      let keys = new HashSet<number>();
      let b_values = Array.from(keys).sort((a, b) => a - b).filter((value, index, self) => self.indexOf(value) === index);

      let a_values = Array.from(keys);

      let a = new MerkleSearchTree();
      let b = new MerkleSearchTree();

      let want_len = b_values.length;

      let unique = new HashSet<number>();
      a_values.forEach(key => {
        if (unique.add(key)) {
          a.upsert(new IntKey(key), 'bananas');
        }
      });
      b_values.forEach(key => {
        b.upsert(new IntKey(key), 'bananas');
      });

      assert_node_equal(a, b);

      let asserter = new InvariantAssertCount(new InvariantAssertOrder(new NopVisitor()));
      a.in_order_traversal(asserter);
      asserter.unwrap_count(want_len);

      asserter = new InvariantAssertCount(new InvariantAssertOrder(new NopVisitor()));
      b.in_order_traversal(asserter);
      asserter.unwrap_count(want_len);
    });

    test('prop_in_order_traversal_key_order', () => {
      let t = new MerkleSearchTree();

      let unique = new HashSet<number>();
      let want_len = 0;

      keys.forEach(key => {
        if (unique.add(key)) {
          want_len += 1;
          t.upsert(new IntKey(key), 'bananas');
        }
      });

      let asserter = new InvariantAssertCount(new InvariantAssertOrder(new NopVisitor()));
      t.in_order_traversal(asserter);
      asserter.unwrap_count(want_len);
    });

    test('prop_root_hash_data_equality', () => {
      let a = new MerkleSearchTree();
      let b = new MerkleSearchTree();

      // They are equal when empty.
      expect(a.root_hash()).toEqual(b.root_hash());

      let unique = new HashSet<number>();
      let last_entry = keys[0];
      keys.forEach(key => {
        if (!unique.add(key)) {
          // Root hashes may compute to the same value if the same
          // (key, value) pair is inserted twice, causing the
          // divergence assert below to spuriously trigger.
          return;
        }

        // Add the key to tree A
        a.upsert(new IntKey(key), 'bananas');
        expect(a.root_hash_cached()).toBeNull();

        // The trees have now diverged
        assert_node_not_equal(a, b);

        // Add the key to tree B
        b.upsert(new IntKey(key), 'bananas');
        expect(b.root_hash_cached()).toBeNull();

        // And now the tees have converged
        assert_node_equal(a, b);
      });

      // Update a value for an existing key
      if (last_entry !== undefined) {
        b.upsert(new IntKey(last_entry), 'platanos');
        expect(b.root_hash_cached()).toBeNull();

        // The trees diverge
        assert_node_not_equal(a, b);

        // And converge once again
        a.upsert(new IntKey(last_entry), 'platanos');
        expect(a.root_hash_cached()).toBeNull();

        // And now the tees have converged
        assert_node_equal(a, b);
      }

      let asserter = new InvariantAssertCount(new InvariantAssertOrder(new NopVisitor()));
      a.in_order_traversal(asserter);
      asserter.unwrap_count(unique.size);

      asserter = new InvariantAssertCount(new InvariantAssertOrder(new NopVisitor()));
      b.in_order_traversal(asserter);
      asserter.unwrap_count(unique.size);
    });

    test('prop_node_iter', () => {
      let t = new MerkleSearchTree();

      let inserted = new BTreeSet<number>();
      keys.forEach(key => {
        t.upsert(key, key);
        inserted.add(key);
      });

      // Use the node iter to visit all nodes, preserving the key order in
      // the returned iterator.
      let got = Array.from(t.node_iter()).map(v => v.key());

      // The iterator must yield all keys in the same order as a (sorted!)
      // BTreeSet to satisfy the invariant.
      expect(Array.from(inserted)).toEqual(got);
    });
  });

  function assert_node_equal<K, V>(a: MerkleSearchTree<K, V>, b: MerkleSearchTree<K, V>) {
    expect(a.root_hash()).toEqual(b.root_hash(), 'root hashes should be equal');
    expect(a.serialise_page_ranges()).toEqual(b.serialise_page_ranges(), 'serialised pages should match');
    // The cached values must always match their computed values.
    expect(b.root_hash_cached()).toEqual(b.root_hash(), 'cached hashes should be equal for b');
    expect(a.root_hash_cached()).toEqual(a.root_hash(), 'cached hashes should be equal for a');
  }

  function assert_node_not_equal<K, V>(a: MerkleSearchTree<K, V>, b: MerkleSearchTree<K, V>) {
    expect(a.root_hash()).not.toEqual(b.root_hash(), 'root hash should not be equal');
    expect(a.serialise_page_ranges()).not.toEqual(b.serialise_page_ranges(), 'serialised pages should not match');
    // The cached values must always match their computed values.
    expect(b.root_hash_cached()).toEqual(b.root_hash(), 'cached hashes should always be equal for b');
    expect(a.root_hash_cached()).toEqual(a.root_hash(), 'cached hashes should always be equal for a');
  }
});

