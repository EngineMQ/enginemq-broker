import { FastifyInstance } from 'fastify';
import fastifyFactory from './fastify';

import * as config from '../config';
import logger from './logger';

const log = logger.child({ module: 'Http' });

let server: FastifyInstance;

export const createHttpserver = async () => {
    if (!config.uiPort) {
        log.info('Http server disabled');
        return;
    }
    log.info('Init http server');

    server = await fastifyFactory();

    return new Promise((resolve, reject) => {
        server.listen(config.uiPort, config.uiHost, (err, address) => {
            if (err) {
                log.error(err)
                reject(err);
            }
            else {
                log.info({ address }, 'Http server listening');
                resolve(server);
            }
        });
    });
}

export const closeHttpserver = async () => {
    return server.close();
};
