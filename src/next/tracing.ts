// import _debug from 'debug';

// Debug macro
function debug(...args: any[]) {
  // if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
  //   _debug('debug')(args);
  // }
  console.log(...args);
}

// Trace macro
function trace(...args: any[]) {
  // if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
  //   _debug('trace')(args);
  // }
  console.log(...args);
}

export { debug, trace };

