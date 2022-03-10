import { FastifyInstance } from 'fastify';
import fastifyFactory from './httpSvc';

import * as config from '../config';
import logger from './logger';

const log = logger.child({ module: 'Http' });

let server: FastifyInstance | null;

export const createHttpserver = async () => {
    server = await fastifyFactory();

    return new Promise((resolve, reject) => {
        if (!server)
            return resolve(null);
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
    if (!server)
        return null;

    log.info('Http server closing');
    return server.close();
};
