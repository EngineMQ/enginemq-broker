import { FastifyInstance } from "fastify"

import api from './api';
import webUI from './webUI';

export const apiRoutes = (server: FastifyInstance) => api(server);
export const webUiRoutes = (server: FastifyInstance) => webUI(server);
