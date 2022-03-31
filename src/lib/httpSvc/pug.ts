import * as path from 'path';
import { FastifyInstance } from 'fastify';
import pointOfView from 'point-of-view';
import * as pug from 'pug';

import { version } from '../../../package.json';
import * as config from '../../config';
import logService from './services/logService';
import { heapUsage, prettyThousand } from '../utility';

export default async (server: FastifyInstance) => {
    server.log.debug('Init template engine');

    await server.register(pointOfView, {
        engine: { pug },
        root: path.join(__dirname, 'webUIViews'),
        viewExt: 'pug',
        includeViewExtension: true,
        propertyName: 'view',
        defaultContext: {
            serviceName: config.serviceName,
            devMode: !config.isProduction,
            appVersion: version,
            newline: '\n',
            getUiNotifications: () => logService.getUiNotification(),
            getMemoryUsageHuman: () => {
                const usage = heapUsage();
                return {
                    used: prettyThousand(usage.used, 2),
                    limit: prettyThousand(usage.limit, 2),
                }
            }
        },
        production: config.isProduction, //cache files?
        options: {
            pretty: !config.isProduction,
        },
    });
}
