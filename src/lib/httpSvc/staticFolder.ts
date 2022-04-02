/* eslint-disable unicorn/prefer-module */
import * as path from 'node:path';
import findupSync = require('findup-sync');
import { FastifyInstance } from 'fastify';
import fastifyStatic from 'fastify-static';

import * as config from '../../config';

const folderNodeModules = path.relative(__dirname, findupSync('node_modules', { cwd: process.cwd() }) || '');
const staticFolders = new Map<string, string>([
    ['/public', '../../public'],
    ['/assets/template', path.join(folderNodeModules, 'admin-lte/dist')],
    ['/assets/plugins', path.join(folderNodeModules, 'admin-lte/plugins')],
    ['/assets/mermaid', path.join(folderNodeModules, 'mermaid/dist')],
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
