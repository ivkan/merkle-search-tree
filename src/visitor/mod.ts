// Trait & implementations for tree structure inspection.

import * as dot from './dot';
import * as pageRangeHash from './page-range-hash';
import * as trait from './trait';

export * from './trait';

// Test-specific modules
if (process.env.NODE_ENV === 'test') {
  const assertCount = require('./assert_count');
  const assertOrder = require('./assert_order');
  const nop = require('./nop');
}

