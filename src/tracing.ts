import _debug from 'debug';
import { Logger } from './logger2/logger';
import { ConsoleLogger } from './logger/console-logger.service';

Logger.setPrefix('MST');
Logger.enableStackTrace(false);

// Debug macro
function debug(...args: any[])
{
  // if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
  //   _debug('debug')(args);
  // }
  // console.log(...args);
  // _debug('debug')('xxxx');
  // Logger.debug(args.shift(), ...args);

  // const logger   = _debug('debug');
  // logger.enabled = true;
  // logger(args.shift(), ...args);
  // Logger.debug(...args);
  const logger = new ConsoleLogger('debug');
  logger.debug(args.shift(), ...args);
}

// Trace macro
function trace(...args: any[])
{
  // if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
  //   _debug('trace')(args);
  // }
  // console.log(...args);
  // _debug('trace')(args);
  // Logger.log(args.shift(), ...args);

  // const logger   = _debug('trace');
  // logger.enabled = true;
  // logger(args.shift(), ...args);
  // Logger.log(...args);
  const logger = new ConsoleLogger('trace');
  logger.verbose(args.shift(), ...args);
}

function assert(...args: any[])
{
  // if (process.env.NODE_ENV === 'test' || process.env.TRACING_ENABLED) {
  //   _debug('trace')(args);
  // }
  // console.log(...args);
  // _debug('trace')(args);
  // Logger.log(args.shift(), ...args);
  // Logger.log(...args);
}

export { debug, trace, assert };

