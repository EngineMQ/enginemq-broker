import { FastifyInstance } from 'fastify';
import resourceService from '../../services/resourceService';
import resourceServiceRouter from '../../services/resourceServiceRouter';
import { reduceArrayIfOneItem, yamlAdaptDateTimeHeader } from '../../../utility';
import { resourceIdRegExp } from '../../../ResourceHandler';

const HTTP_NOT_FOUND = 404;

const BREADCRUMB_TO_LIST = [{ url: '/resources', title: 'Resources' }];

export default (server: FastifyInstance) => {
    server

        .get('/resources/routers/yaml', async (_request, reply) => {
            const yamlAll = resourceServiceRouter.getAllRoutersYaml();
            if (yamlAll)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', 'attachment; filename=routers.yaml')
                    .send(yamlAdaptDateTimeHeader(yamlAll));
            return reply.code(HTTP_NOT_FOUND).send('Cannot find any router');
        })

        .get<{ Params: { resourceId: string } }>(`/resources/router/:resourceId(${resourceIdRegExp})`, async (request, reply) => {
            const { resourceId } = request.params;
            const router = resourceServiceRouter.getRouter(resourceId);
            if (router)
                return reply.view('resources/routerEdit', {
                    title: 'Router',
                    subtitle: router.description,
                    breadcrumb: BREADCRUMB_TO_LIST,
                    resourceId,
                    router: router.getOptions(),
                });
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${resourceId}`);
        })

        .get<{ Params: { resourceId: string } }>(`/resources/router/:resourceId(${resourceIdRegExp})/yaml`, async (request, reply) => {
            const { resourceId } = request.params;
            const router = resourceServiceRouter.getRouter(resourceId);
            if (router)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', `attachment; filename=${resourceId}.yaml`)
                    .send(yamlAdaptDateTimeHeader(router.getYaml(resourceId)));
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${resourceId}`);
        })

        .get('/resources/routers/map', async (_request, reply) => {
            const routers = resourceServiceRouter.getAllRoutersForMap();

            const mermaid: string[] = [];
            mermaid.push('graph LR');
            for (const router of routers)
                for (const route of router.routes)
                    mermaid.push(`${route.from}([${route.from}]) ${router.hold ? '-.->' : '-->'} |${router.description}| ${route.to}([${route.to}])`);

            return reply.view('resources/routerMap', {
                title: 'Routers map',
                breadcrumb: BREADCRUMB_TO_LIST,
                mermaid: mermaid.join('\n'),
            });
        })

        .get('/resources/routers/new', async (_request, reply) => {
            return reply.view('resources/routerEdit', {
                title: 'New router',
                breadcrumb: BREADCRUMB_TO_LIST,
                resourceId: '',
                router: {
                    description: '',
                    topic: '',
                    copyTo: '',
                    moveTo: '',
                }
            });
        })

        .get<{ Params: { resourceId: string } }>(`/resources/routers/copy/:resourceId(${resourceIdRegExp})`, async (request, reply) => {
            const { resourceId } = request.params;
            const router = resourceServiceRouter.getRouter(resourceId);
            if (router) {
                const options = { ...router.getOptions() };
                options.description = 'Copy of ' + options.description;
                return reply.view('resources/routerEdit', {
                    title: 'Router',
                    subtitle: router.description,
                    breadcrumb: BREADCRUMB_TO_LIST,
                    resourceId: '',
                    router: options,
                });
            }
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${resourceId}`);
        })

        .post<{
            Body: {
                resourceId: string,
                description: string,
                topic: string,
                copyTo: string,
                moveTo: string
            }
        }>('/resources/routers/update', async (request, reply) => {
            const { resourceId, description, topic, copyTo, moveTo } = request.body;
            resourceServiceRouter.insertOrUpdateRouter(resourceId, {
                description,
                topic,
                copyTo: reduceArrayIfOneItem(copyTo.split('\r\n').filter(Boolean)),
                moveTo: reduceArrayIfOneItem(moveTo.split('\r\n').filter(Boolean)),
            });
            return reply.send('OK');
        })

        .post('/resources/routers/upload/yaml', async (request, reply) => {
            const file = await request.file();
            const buffer = await file.toBuffer();
            resourceService.createFromYaml(buffer);
            return reply.send('OK');
        })

        .post<{ Body: { resourceId: string } }>('/resources/routers/delete', async (request, reply) => {
            const { resourceId } = request.body;
            resourceServiceRouter.deleteRouter(resourceId);
            return reply.send('OK');
        })

        .post('/resources/routers/delete/all', async (_request, reply) => {
            resourceServiceRouter.deleteAllRouter();
            return reply.send('OK');
        })

}
