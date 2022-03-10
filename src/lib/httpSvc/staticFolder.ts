import * as path from 'path';
import { FastifyInstance } from 'fastify';
import fastifyStatic from 'fastify-static';

import * as config from '../../config';

const rootParentFolder = '../../';
const nodeModulesParentFolder = '../../../';
const staticFolders = new Map<string, string>([
    ['/public', path.join(rootParentFolder, 'public')],
    ['/assets/template', path.join(nodeModulesParentFolder, 'node_modules/admin-lte/dist')],
    ['/assets/plugins', path.join(nodeModulesParentFolder, 'node_modules/admin-lte/plugins')],
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
