import * as path from 'path';
import { FastifyInstance } from 'fastify';
import fastifyFavicon from 'fastify-favicon';

export default async (server: FastifyInstance) => {
    server.log.debug('Init favicon');

    await server.register(fastifyFavicon, {
        path: path.join(__dirname, '../../public/favicon'),
        name: 'favicon.ico'
    });
}
