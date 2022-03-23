import { FastifyInstance } from "fastify"

import main from './main';
import client from './client';
import topic from './topic';
import log from './log';

export default (server: FastifyInstance) => {
    main(server);
    client(server);
    topic(server);
    log(server);
}