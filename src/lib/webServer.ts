import fastify, { FastifyInstance } from 'fastify';

import * as config from '../config';
import logger from './logger';
import * as routes from '../route';

const log = logger.child({ module: 'Webserver' });

let server: FastifyInstance;

export const createWebserver = async () => {
    if (!config.uiPort) {
        log.info('Webserver not used');
        return;
    }
    log.info('Init webserver');

    server = fastify({
        logger: logger.child({ module: 'Http' }),
    });

    routes.initRoute(server);

    return new Promise((resolve, reject) => {
        server.listen(config.uiPort, config.uiHost, (err, address) => {
            if (err) {
                log.error(err)
                reject(err);
            }
            else {
                log.info({ address }, 'Webserver listening');
                resolve(server);
            }
        });
    });
}

export const closeWebserver = async () => {
    return server.close();
};
