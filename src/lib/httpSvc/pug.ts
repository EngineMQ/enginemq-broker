import * as path from 'path';
import { FastifyInstance } from 'fastify';
import pointOfView from "point-of-view";
import * as pug from 'pug';

import { version } from '../../../package.json';
import * as config from '../../config';
import logService from './services/logService';

export default async (server: FastifyInstance) => {
    server.log.debug('Init template engine');

    await server.register(pointOfView, {
        engine: { pug },
        root: path.join(__dirname, "webUIViews"),
        viewExt: "pug",
        includeViewExtension: true,
        propertyName: "view",
        defaultContext: {
            serviceName: config.serviceName,
            devMode: !config.isProduction,
            appVersion: version,
            getUiNotifications: () => logService.getUiNotification(),
        },
        production: config.isProduction, //cache files?
        options: {
            pretty: !config.isProduction,
        },
    });
    console.log(logService.getUiNotification());
}
