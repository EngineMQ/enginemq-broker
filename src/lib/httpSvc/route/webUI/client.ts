import { FastifyInstance } from "fastify";
import clientService from "../../services/clientService";

export default (server: FastifyInstance) => {
    server

        .get('/client', async (_request, reply) => {
            const clients = clientService.getAllClients();
            return reply.view("clientList", {
                title: "Clients",
                breadcrumb: [],
                clients,
            });
        })

        .get<{ Params: { uniqueId: number } }>('/client/:uniqueId(^\\d+$)', async (request, reply) => {
            const uniqueId = request.params.uniqueId;
            const client = clientService.getClient(uniqueId);
            return reply.view("client", {
                title: 'Client',
                subtitle: `#${uniqueId}`,
                breadcrumb: [{ url: '/client', title: 'Clients' }],
                uniqueId,
                client,
            });
        })

        .post<{ Body: { uniqueId: number } }>('/client/kick', async (request, reply) => {
            clientService.kickClient(request.body.uniqueId);
            return reply.send("OK");
        })
}
