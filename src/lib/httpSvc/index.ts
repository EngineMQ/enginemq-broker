import { nanoid } from 'nanoid';
import fastify, { FastifyInstance } from 'fastify';
import fastifyHelmet from 'fastify-helmet';
import fastifyCompress from 'fastify-compress';
import fastifyEtag from 'fastify-etag';

import * as config from '../../config';
import logger from '../logger';
import staticFolder from './staticFolder'
import session from './session'
import pug from './pug'
import * as routes from './route';

const HTTP_ERROR_MIN = 400;

const log = logger.child({ module: 'Http' });
const logPlugins = logger.child({ module: 'Http' });
logPlugins.level = 'warn';

export default async (): Promise<FastifyInstance | null> => {
    if (!config.apiEnabled && !config.webUIEnabled) {
        log.info('Http server disabled');
        return null;
    }

    log.info('Init http server');
    const server = fastify({
        genReqId: () => nanoid(),
        logger: log,
        disableRequestLogging: true,
        bodyLimit: 2 * 1024 * 1024,
        ignoreTrailingSlash: true,
    });
    await server.register(fastifyHelmet, { contentSecurityPolicy: false });
    await server.register(fastifyCompress, { global: false });
    await server.register(fastifyEtag);

    server.addHook("onRequest", (req, _reply, done) => {
        req.log.debug({ method: req.method, url: req.raw.url, session: req.session, }, "Incoming request");
        req.log = logPlugins;
        done();
    });
    server.addHook('onResponse', async (req, reply) => {
        await reply.headers({
            'Surrogate-Control': 'no-store',
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });
        if (reply.raw.statusCode >= HTTP_ERROR_MIN)
            req.log.error({ url: req.raw.url, statusMessage: reply.raw.statusMessage, statusCode: reply.raw.statusCode, }, "Request error");
        else
            req.log.debug({ url: req.raw.url, statusCode: reply.raw.statusCode, }, "Request completed");
    })

    if (config.webUIEnabled) {
        server.log.debug('Init WebUI');

        await staticFolder(server);
        await session(server);
        await pug(server);

        routes.webUiRoutes(server);
    }

    if (config.apiEnabled) {
        server.log.debug('Init API');

        routes.apiRoutes(server);
    }

    return server;
}
