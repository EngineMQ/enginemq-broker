/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
    serializers: {
        req(request) {
            return {
                method: request.method,
                url: request.url,
                path: request.path,
                parameters: request.parameters,
                body: request.body,
            };
        },
        res(reply) {
            return {
                statusCode: reply.statusCode,
                headers: reply.headers,
                payload: reply.payload,
            };
        },
    },
});
