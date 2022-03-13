import logger from './lib/logger';
import * as config from './config';
import { createBroker, closeBroker } from './lib/broker';
import { createHttpserver, closeHttpserver } from './lib/http';

const EXITCODE_BASE = 128;
const EXITCODE_SIGTERM = 15;

const log = logger.child({ module: 'Sys' });

const start = async () => {
  try {
    if (!config.isProduction)
      log.warn('Developer mode active');
    await createBroker();
    await createHttpserver();
  } catch (err) {
    log.error(err);
    process.exit(1);
  }
};

const stop = async (): Promise<void> => {
  try {
    void closeHttpserver();
    await closeBroker();
  } catch (err) {
    log.error(err);
    process.exit(1);
  }
  process.exit(0);
};

void start();

process.on('exit', stop);
process.on('SIGHUP', () => process.exit(EXITCODE_BASE + 1));
process.on('SIGINT', () => process.exit(EXITCODE_BASE + 2));
process.on('SIGTERM', () => process.exit(EXITCODE_BASE + EXITCODE_SIGTERM));