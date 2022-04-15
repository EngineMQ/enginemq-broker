import { nanoid } from 'nanoid';
import fastify, { FastifyInstance } from 'fastify';
import fastifyFormBody from 'fastify-formbody';
import fastifyMultipart from 'fastify-multipart';
import fastifyHelmet from 'fastify-helmet';
import fastifyCompress from 'fastify-compress';
import fastifyEtag from 'fastify-etag';

import * as config from '../../config';
import logger from '../logger';
import staticFolder from './staticFolder'
import session from './session'
import pug from './pug'
import favicon from './favicon'
import * as routes from './route';

const HTTP_ERROR_MIN = 400;
const HTTP_302 = 302;

const log = logger.child({ module: 'Http' });
const logPlugins = logger.child({ module: 'Http' });
logPlugins.level = 'warn';

export default async (): Promise<FastifyInstance | undefined> => {
    if (!config.apiEnabled && !config.webUIEnabled) {
        log.info('Http server disabled');
        return undefined;
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
    await server.register(fastifyFormBody);
    await server.register(fastifyMultipart);

    server.addHook('onRequest', (request, _reply, done) => {
        request.log.debug({ method: request.method, url: request.raw.url, session: request.session, }, 'Incoming request');
        request.log = logPlugins;

        return done();
    });
    server.addHook('onResponse', async (request, reply) => {
        await reply.headers({
            'Surrogate-Control': 'no-store',
            'Cache-Control': 'no-store, max-age=0, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });
        if (reply.raw.statusCode >= HTTP_ERROR_MIN)
            request.log.error({ url: request.raw.url, statusMessage: reply.raw.statusMessage, statusCode: reply.raw.statusCode, }, 'Request error');
        else
            request.log.debug({ url: request.raw.url, statusCode: reply.raw.statusCode, }, 'Request completed');
    })

    const protectedRoutes: string[] = [];
    server.decorate('protectRoute', (...pRoutes: string[]) => {
        protectedRoutes.push(...pRoutes);
    })
    server.addHook('preHandler', (request, reply, next) => {
        if (
            !Context.ResourceHandler.isAnonymousWebUiMode() &&
            !request.session.data['auth'] &&
            ['GET', 'POST'].includes(request.method)
        )
            for (const pRoute of protectedRoutes)
                if (request.raw.url?.startsWith(pRoute))
                    return reply.redirect(HTTP_302, '/');
        return next();
    })

    if (config.webUIEnabled) {
        server.log.debug('Init WebUI');

        await staticFolder(server);
        await session(server);
        await pug(server);
        await favicon(server);

        routes.webUiRoutes(server);
    }

    if (config.apiEnabled) {
        server.log.debug('Init API');

        routes.apiRoutes(server);
    }

    return server;
}
