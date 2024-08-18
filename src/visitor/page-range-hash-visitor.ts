import { Visitor } from './visitor';
import { PageRange } from '../diff/page-range';
import { Page } from '../page';
import { Node } from '../node';

/**
 * Record the page range & hashes for the visited pages.
 */
export class PageRangeHashVisitor<K extends number> implements Visitor<K>
{
  private readonly out: PageRange<K>[];

  constructor()
  {
    this.out = [];
  }

  visitNode(_node: Node<K>): boolean
  {
    return true;
  }

  visitPage(page: Page<K>, _highPage: boolean): boolean
  {
    this.out.push(PageRange.fromPage(page));
    return true;
  }

  finalise(): PageRange<K>[]
  {
    return this.out;
  }
}

