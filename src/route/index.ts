import { FastifyInstance } from "fastify"

// interface IQuerystring {
//     username: string;
//     password: string;
// }

export const initRoute = (server: FastifyInstance) => {

    server
        .get<{
            Querystring: {
                username: string;
                password: string;
            },
            Reply: {
                data: string;
            }
        }>
        ('/', async (request, reply) => {
            const { username, password } = request.query

            await reply.send({ data: username + password });
        })
}