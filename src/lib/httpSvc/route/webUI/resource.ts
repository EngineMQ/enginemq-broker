import { nanoid } from 'nanoid';
import { FastifyInstance } from "fastify";
import resourceService from "../../services/resourceService";

const HTTP_NOT_FOUND = 404;
const NEWROUTER_NAMEID_LENGTH = 8;

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

        .get<{ Params: { routername: string } }>('/resources/router/:routername(^[a-z0-9-]+$)', async (request, reply) => {
            const routerName = request.params.routername;
            const router = resourceService.getRouter(routerName);
            if (router)
                return reply.view("router", {
                    title: 'Router',
                    subtitle: routerName,
                    breadcrumb: [{ url: '/resources/routers', title: 'Routers' }],
                    routerName,
                    router,
                });
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find router ${routerName}`);
        })

        .get('/resources/newrouter', async (_request, reply) => {
            const routerName = `router-${nanoid(NEWROUTER_NAMEID_LENGTH)}`;
            return reply.view("router", {
                title: 'New router',
                breadcrumb: [{ url: '/resources/routers', title: 'Routers' }],
                routerName,
            });
        })

    // .post<{ Body: { topicname: string } }>('/topic/clear', async (request, reply) => {
    //     topicService.clearTopic(request.body.topicname);
    //     return reply.send("OK");
    // })

}
