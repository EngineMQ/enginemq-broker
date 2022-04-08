/* eslint-disable unicorn/prefer-module */
import * as path from 'node:path';
import { FastifyInstance } from 'fastify';
import fastifyStatic from 'fastify-static';

import * as config from '../../config';

const staticFolders = new Map<string, string>([
    ['/public', '../../public'],
    ['/assets/template', '../../assets/admin-lte/dist'],
    ['/assets/plugins', '../../assets/admin-lte/plugins'],
    ['/assets/mermaid', '../../assets/mermaid/dist'],
]);

export default async (server: FastifyInstance) => {
    server.log.debug({ routes: staticFolders.size }, 'Init static files');

    let isFirst = true;
    for (const prefix of staticFolders.keys()) {
        await server.register(fastifyStatic, {
            prefix: prefix,
            root: path.join(__dirname, staticFolders.get(prefix) || ''),
            decorateReply: isFirst,

            index: false,
            list: !config.isProduction,
        });
        isFirst = false;
    }
}
