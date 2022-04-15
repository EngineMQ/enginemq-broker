import { FastifyInstance } from 'fastify';

declare module 'fastify' {
    interface FastifyInstance {
        protectRoute: (...pRoutes: string[]) => void
    }
}
