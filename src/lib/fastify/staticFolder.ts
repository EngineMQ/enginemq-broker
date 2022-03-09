import * as path from 'path';
import { FastifyInstance } from 'fastify';
import fastifyStatic from 'fastify-static';

import * as config from '../../config';

const parentFolder = '../../../';
const staticFolders = new Map<string, string>([
    ['/assets/template', 'node_modules/admin-lte/dist'],
    ['/assets/plugins', 'node_modules/admin-lte/plugins'],
]);

export default async (server: FastifyInstance) => {
    server.log.debug({ count: staticFolders.size }, 'Init static files');

    let isFirst = true;
    for (const prefix of staticFolders.keys()) {
        await server.register(fastifyStatic, {
            prefix: prefix,
            root: path.join(__dirname, parentFolder, staticFolders.get(prefix) || ''),
            decorateReply: isFirst,

            index: false,
            list: !config.isProduction,
        });
        isFirst = false;
    }
}
