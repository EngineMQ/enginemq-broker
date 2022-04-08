import { FastifyInstance } from 'fastify'

import main from './main';
import client from './client';
import topic from './topic';
import log from './log';
import resource from './resource';
import resourceRouter from './resourceRouter';
import resourceValidator from './resourceValidator';

export default (server: FastifyInstance) => {
    main(server);
    client(server);
    topic(server);
    log(server);
    resource(server);
    resourceRouter(server);
    resourceValidator(server);
}