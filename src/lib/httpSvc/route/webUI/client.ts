import { FastifyInstance } from "fastify";
import webUIService from "../../services/webUIService";

export default (server: FastifyInstance) => {
    //'/example/:file(^\\d+).png'
    server
        .get('/client', async (_request, reply) => {
            const clients = webUIService.getAllClients();
            return reply.view("clientList", {
                title: "Clients",
                subtitle: clients.length,
                clients,
            });
        })
        .get<{ Params: { client: string } }>('/client/:client', async (request, reply) => {
            console.log(request.params.client);
            return reply.view("clientList", {
                title: request.params.client + "Clients",
            });
        })
}
