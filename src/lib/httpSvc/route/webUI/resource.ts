import { customAlphabet } from 'nanoid';
import { FastifyInstance } from "fastify";
import resourceService from "../../services/resourceService";
import { reduceArrayIfOneItem } from '../../../utility';

const HTTP_NOT_FOUND = 404;
const NEWROUTER_NAMEID_LENGTH = 8;
const nanoidTempName = customAlphabet('1234567890abcdef', NEWROUTER_NAMEID_LENGTH);

const breadcrumbAtEditor = [{ url: '/resources/routers', title: 'Routers' }];

export default (server: FastifyInstance) => {
    server

        .get('/resources/routers', async (_request, reply) => {
            const routers = resourceService.getAllRouters();
            return reply.view("routerList", {
                title: "Routers",
                breadcrumb: [],
                routers,
            });
        })

        .get<{ Params: { resourceId: string } }>('/resources/router/:resourceId(^[0-9a-f]{1,20}$)', async (request, reply) => {
            const { resourceId } = request.params;
            const router = resourceService.getRouter(resourceId);
            if (router)
                return reply.view("routerEdit", {
                    title: 'Router',
                    subtitle: router.name,
                    breadcrumb: breadcrumbAtEditor,
                    resourceId,
                    router: router.getOptions(),
                });
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${resourceId}`);
        })

        .get<{ Params: { resourceId: string } }>('/resources/router/:resourceId(^[0-9a-f]{1,20}$)/yaml', async (request, reply) => {
            const { resourceId } = request.params;
            const router = resourceService.getRouter(resourceId);
            if (router)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', `attachment; filename=${resourceId}.yaml`)
                    .send(router.getYaml());
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${resourceId}`);
        })

        .get('/resources/routers/map', async (_request, reply) => {
            const routers = resourceService.getAllRouters();

            const mermaid: string[] = [];
            mermaid.push('graph LR');
            for (const router of routers)
                for (const route of router.routes)
                    mermaid.push(`${route.from}([${route.from}]) ${router.hold ? '-.->' : '-->'} |${router.name}| ${route.to}([${route.to}])`);

            return reply.view("routerMap", {
                title: "Routers map",
                breadcrumb: breadcrumbAtEditor,
                mermaid: mermaid.join('\n'),
            });
        })

        .get('/resources/routers/new', async (_request, reply) => {
            return reply.view("routerEdit", {
                title: 'New router',
                breadcrumb: breadcrumbAtEditor,
                resourceId: '',
                router: {
                    name: `router-${nanoidTempName()}`,
                    topic: '',
                    copyTo: [], moveTo: []
                }
            });
        })

        .get<{ Params: { resourceId: string } }>('/resources/routers/copy/:resourceId(^[0-9a-f]{1,20}$)', async (request, reply) => {
            const { resourceId } = request.params;
            const router = resourceService.getRouter(resourceId);
            if (router)
                return reply.view("routerEdit", {
                    title: 'Router',
                    subtitle: router.name,
                    breadcrumb: breadcrumbAtEditor,
                    resourceId: '',
                    router: router.getOptions(),
                });
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${resourceId}`);
        })

        .post<{
            Body: {
                resourceId: string,
                name: string,
                topic: string,
                copyTo: string,
                moveTo: string
            }
        }>('/resources/routers/update', async (request, reply) => {
            const { resourceId, name, topic, copyTo, moveTo } = request.body;
            resourceService.insertOrUpdateRouter(resourceId, {
                name,
                topic,
                copyTo: reduceArrayIfOneItem(copyTo.split('\r\n').filter((i) => i)),
                moveTo: reduceArrayIfOneItem(moveTo.split('\r\n').filter((i) => i)),
            });
            return reply.send("OK");
        })

        .post<{ Body: { resourceId: string } }>('/resources/routers/delete', async (request, reply) => {
            const { resourceId } = request.body;
            resourceService.deleteRouter(resourceId);
            return reply.send("OK");
        })

}
