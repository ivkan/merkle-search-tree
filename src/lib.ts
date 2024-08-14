// Copyright 2023 Dominic Dwyer (dom@itsallbroken.com)
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License. You may obtain a copy
// of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

// Importing required modules
import * as tracing from './tracing';
import * as diff from './diff';
import * as digest from './digest';
import * as node from './node';
import * as nodeIter from './node_iter';
import * as page from './page';
import * as tree from './tree';
import * as visitor from './visitor';

// Exporting modules
export { diff, digest, visitor };
export * from './node';
export * from './page';
export * from './tree';

// Test-related imports and exports (commented out as they are conditionally included in Rust)
// import * as criterion from 'criterion';
// import * as tracingSubscriber from 'tracing-subscriber';
// import * as testAssert from './test_assert';
// import * as testUtil from './test_util';

// Note: TypeScript doesn't have direct equivalents for Rust's attribute macros.
// The functionality provided by these attributes (like documentation, linting, etc.)
// would typically be handled differently in a TypeScript project, often through
// separate tools like TSDoc, ESLint, etc.

