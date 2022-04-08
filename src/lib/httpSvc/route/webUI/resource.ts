import { FastifyInstance } from 'fastify';
import { yamlAdaptDateTimeHeader } from '../../../utility';
import resourceService from '../../services/resourceService';

export const BREADCRUMB_TO_LIST = [{ url: '/resources', title: 'Resources' }];

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

        .get('/resources/yaml', async (_request, reply) => {
            const yamlAll = resourceService.getAllResourceYaml();
            return reply
                .type('text/yaml')
                .header('Content-Disposition', 'attachment; filename=resources.yaml')
                .send(yamlAdaptDateTimeHeader(yamlAll));
        })

        .post('/resources/upload/yaml', async (request, reply) => {
            const file = await request.file();
            const buffer = await file.toBuffer();
            resourceService.createFromYaml(buffer);
            return reply.send('OK');
        })

        .post('/resources/delete/all', async (_request, reply) => {
            resourceService.deleteAll();
            return reply.send('OK');
        })

};
