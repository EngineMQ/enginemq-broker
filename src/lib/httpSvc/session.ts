import { FastifyInstance } from 'fastify';
import fastifyCookie from 'fastify-cookie';
import fastifySession from '@mgcrea/fastify-session';

import * as config from '../../config';
import { SessionStoreLocal } from './sessionStoreLocal';

const SESSION_SECRET = 'This is a secret sentence for SESSION transactions'
const SESSION_TTL = 86_400 // 1 day in seconds

export default async (server: FastifyInstance) => {
    server.log.debug('Init session');

    await server.register(fastifyCookie);

    let sessionOption = {
        secret: SESSION_SECRET,
        cookie: { maxAge: SESSION_TTL },
    };
    if (!config.isProduction)
        sessionOption = Object.assign(sessionOption, {
            store: new SessionStoreLocal('./.sessions')
        })
    await server.register(fastifySession, sessionOption);
}
