import fastify, { FastifyInstance } from 'fastify';

import logger from '../logger';
import staticFolder from './staticFolder'
import pug from './pug'
import * as routes from './route';

export default async (): Promise<FastifyInstance> => {
    const server = fastify({
        logger: logger.child({ module: 'UI' }),
        bodyLimit: 2 * 1024 * 1024,
        ignoreTrailingSlash: true,
    });

    await staticFolder(server);
    await pug(server);

    routes.initRoute(server);

    return server;
}
