import * as path from 'path';
import { FastifyInstance } from 'fastify';
import pointOfView from "point-of-view";
import * as pug from 'pug';

import * as config from '../../config';

export default async (server: FastifyInstance) => {
    server.log.debug('Init pug engine');

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await server.register(pointOfView, {
        engine: { pug, },
        root: path.join(__dirname, "views"),
        viewExt: "pug",
        includeViewExtension: true,
        propertyName: "view",
        defaultContext: {
            serviceName: config.serviceName,
            dev: !config.isProduction,
        },
        production: config.isProduction, //cache files
        options: {
            pretty: !config.isProduction,
        },
    });
}
