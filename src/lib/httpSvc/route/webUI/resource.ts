import { FastifyInstance } from 'fastify';
import resourceService from '../../services/resourceService';

export default (server: FastifyInstance) => {
    server

        .get('/resources', async (_request, reply) => {
            const resourceGroups = resourceService.getAllResourcesByGroup();
            return reply.view('resources/resourceGroupList', {
                title: 'Resources',
                breadcrumb: [],
                resources: resourceGroups,
            });
        })
};
