import fastify, { FastifyInstance } from 'fastify';
import fastifyHelmet from 'fastify-helmet';
import fastifyCompress from 'fastify-compress';
import fastifyEtag from 'fastify-etag';

import logger from '../logger';
import staticFolder from './staticFolder'
import session from './session'
import pug from './pug'
import favicon from './favicon'
import * as routes from './route';

export default async (): Promise<FastifyInstance> => {
    const server = fastify({
        logger: logger.child({ module: 'UI' }),
        bodyLimit: 2 * 1024 * 1024,
        ignoreTrailingSlash: true,
    });
    await server.register(fastifyHelmet, { contentSecurityPolicy: false });
    await server.register(fastifyCompress, { global: false });
    await server.register(fastifyEtag);

    server.addHook('onResponse', async (_req, reply) => {
        await reply.headers({
            'Surrogate-Control': 'no-store',
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });
    })

    await staticFolder(server);
    await session(server);
    await pug(server);
    await favicon(server);

    routes.initRoute(server);

    return server;
}
