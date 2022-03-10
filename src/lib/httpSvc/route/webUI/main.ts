import { FastifyInstance } from "fastify"

let i = 0;
export default(server: FastifyInstance) => {

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
