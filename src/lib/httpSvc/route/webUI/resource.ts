import { customAlphabet } from 'nanoid';
import { FastifyInstance } from "fastify";
import resourceService from "../../services/resourceService";

const HTTP_NOT_FOUND = 404;
const NEWROUTER_NAMEID_LENGTH = 8;
const nanoid = customAlphabet('1234567890abcdef', NEWROUTER_NAMEID_LENGTH);

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

        .get<{ Params: { routerName: string } }>('/resources/router/:routerName(^[a-z0-9-]+$)', async (request, reply) => {
            const { routerName } = request.params;
            const router = resourceService.getRouter(routerName);
            if (router)
                return reply.view("routerEdit", {
                    title: 'Router',
                    subtitle: routerName,
                    breadcrumb: [{ url: '/resources/routers', title: 'Routers' }],
                    routerName,
                    router: router.getOptions(),
                });
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${routerName}`);
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
                breadcrumb: [{ url: '/resources/routers', title: 'Routers' }],
                mermaid: mermaid.join('\n'),
            });
        })

        .get('/resources/routers/new', async (_request, reply) => {
            return reply.view("routerEdit", {
                title: 'New router',
                breadcrumb: [{ url: '/resources/routers', title: 'Routers' }],
                routerName: '',
                router: {
                    name: `router-${nanoid()}`,
                    topic: '',
                    copyTo: [], moveTo: []
                }
            });
        })

        .post<{
            Body: {
                routerName: string,
                name: string,
                topic: string,
                copyTo: string,
                moveTo: string
            }
        }>('/resources/routers/update', async (request, reply) => {
            const { routerName, name, topic, copyTo, moveTo } = request.body;
            resourceService.insertOrUpdateRouter(routerName, {
                name,
                topic,
                copyTo: copyTo.split('\r\n').filter((i) => i),
                moveTo: moveTo.split('\r\n').filter((i) => i)
            });
            return reply.send("OK");
        })

        .post<{ Body: { routerName: string } }>('/resources/routers/delete', async (request, reply) => {
            const { routerName } = request.body;
            resourceService.deleteRouter(routerName);
            return reply.send("OK");
        })

}
