import logger from './lib/logger';
import { createBroker, closeBroker } from './lib/broker';

const log = logger.child({ module: 'Sys' });

const start = async () => {
  try {
    await createBroker();
  } catch (err) {
    log.error(err);
    process.exit(1);
  }
};

const stop = (): void => {
  try {
    void closeBroker();
  } catch (err) {
    log.error(err);
    process.exit(1);
  }
  process.exit(0);
};

void start();

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
