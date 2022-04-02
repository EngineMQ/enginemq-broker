import { FastifyInstance } from 'fastify';
import fastifyFactory from './httpSvc';

import * as config from '../config';
import logger from './logger';

const log = logger.child({ module: 'Http' });

let server: FastifyInstance | undefined;

export const createHttpserver = async () => {
    server = await fastifyFactory();

    return new Promise((resolve, reject) => {
        if (!server)
            return resolve('');
        server.listen(config.uiPort, config.uiHost, (error, address) => {
            if (error) {
                log.error(error)
                reject(error);
            }
            else {
                log.info({ address }, 'Http server listening');
                resolve(server);
            }
        });
    });
}

export const closeHttpserver = async () => {
    if (!server)
        return;

    log.info('Http server closing');
    return server.close();
};
