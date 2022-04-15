import { FastifyInstance } from 'fastify';
import fastifyCookie from 'fastify-cookie';
import fastifySession from '@mgcrea/fastify-session';

const SESSION_SECRET = 'This is a secret sentence for SESSION transactions'
const SESSION_TTL = 86_400 // 1 day in seconds

export default async (server: FastifyInstance) => {
    server.log.debug('Init session');

    await server.register(fastifyCookie);
    await server.register(fastifySession, {
        secret: SESSION_SECRET,
        cookie: { maxAge: SESSION_TTL },
        //store: null,
    });
}
