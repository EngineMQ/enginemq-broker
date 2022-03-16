import { FastifyInstance } from "fastify";

export default (server: FastifyInstance) => {
    server
        .get('/client', async (_request, reply) => {
            return reply.view("clientList", {
                title: "Clients",
            });
        })
        .get<{ Params: { client: string } }>('/client/:client', async (request, reply) => {
            console.log(request.params.client);
            return reply.view("clientList", {
                title: request.params.client + "Clients",
            });
        })
}
