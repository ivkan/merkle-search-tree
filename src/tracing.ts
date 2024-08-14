import { once } from 'node:events';
import * as tracing from 'tracing';
import { FmtSubscriber } from 'tracing-subscriber';

// For testing purposes
export const LOGGING_INIT = once(() => {});

// Debug macro
function debug(...args: any[]) {
  if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
    tracing.debug(...args);
  }
}

// Trace macro
function trace(...args: any[]) {
  if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
    tracing.trace(...args);
  }
}

// Enable logging for tests
function enableLogging() {
  if (process.env.NODE_ENV === 'test') {
    LOGGING_INIT(() => {
      const subscriber = new FmtSubscriber()
        .withEnvFilter('trace')
        .withTestWriter()
        .pretty()
        .finish();

      tracing.setGlobalDefault(subscriber)
        .catch(error => console.error('Failed to enable test logging:', error));
    });
  }
}

export { debug, trace, enableLogging };

