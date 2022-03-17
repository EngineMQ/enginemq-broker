import { FastifyInstance } from "fastify";
import webUIService from "../../services/webUIService";

export default (server: FastifyInstance) => {
    //'/example/:file(^\\d+).png'
    server

        .get('/client', async (_request, reply) => {
            const clients = webUIService.getAllClients();
            return reply.view("clientList", {
                title: "Clients",
                breadcrumb: [],
                clients,
            });
        })

        .get<{ Params: { uniqueId: number } }>('/client/:uniqueId(^\\d+)', async (request, reply) => {
            const uniqueId = request.params.uniqueId;
            const client = webUIService.getClient(request.params.uniqueId);
            return reply.view("client", {
                title: `Client #${uniqueId}`,
                breadcrumb: [{ url: '/client', title: 'Clients' }],
                uniqueId,
                client,
            });
        })

        .post<{ Body: { uniqueId: number } }>('/client/kick', async (request, reply) => {
            webUIService.kickClient(request.body.uniqueId);
            return reply.send("OK");
        })
}
