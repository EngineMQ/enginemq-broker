import { FastifyInstance } from "fastify"

import main from './main';
import client from './client';

export default (server: FastifyInstance) => {
    main(server);
    client(server);
}