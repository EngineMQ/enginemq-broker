import { FastifyInstance } from "fastify"

// interface IQuerystring {
//     username: string;
//     password: string;
// }
let i = 0;
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
            return reply.view("main", { u: username + (i++).toString(), password });
            // await reply.send({ data: username + password });
        })
}