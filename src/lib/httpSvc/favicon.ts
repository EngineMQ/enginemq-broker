import { FastifyInstance } from 'fastify';
import fastifyFavicon from 'fastify-favicon';

export default async (server: FastifyInstance) => {
    server.log.debug('Init favicon');

    await server.register(fastifyFavicon, {
        path: 'src/public/favicon',
        name: 'favicon.ico',
    });
}
