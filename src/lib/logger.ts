import { pino } from 'pino';

import * as config from '../config';

export default pino({
    name: config.serviceName,
    level: config.logLevel,
    formatters: {
        level(label) {
            return { level: label }
        }
    },
});
