import { DotVisitor } from './visitor/dot';
import { InvariantAssertOrder } from './visitor/assert-order';
import { NopVisitor } from './visitor/nop';
import { assert } from 'insta';

/**
 * Assert the ordering invariants of a tree, and validating the structure
 * against a DOT-formatted snapshot.
 */
export function assertTree(input: any): void
{
  if ('page' in input)
  {
    // Validate a page, not a tree.
    const page = input.page;

    const v                  = new DotVisitor();
    const assertOrderVisitor = new InvariantAssertOrder(v);
    page.inOrderTraversal(assertOrderVisitor, false);

    assert.snapshot(assertOrderVisitor.getInner().finalise());
  }
  else
  {
    // Validate a tree.
    const tree = input;

    const dotVisitor = new DotVisitor();
    tree.inOrderTraversal(dotVisitor);
    const dot = dotVisitor.finalise();
    console.log(dot);

    const assertOrderVisitor = new InvariantAssertOrder(new NopVisitor());
    tree.inOrderTraversal(assertOrderVisitor);

    assert.snapshot(dot);
  }
}

