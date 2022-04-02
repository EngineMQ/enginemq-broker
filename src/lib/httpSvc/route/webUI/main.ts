import { FastifyInstance } from 'fastify'

let index = 0;
export default (server: FastifyInstance) => {

    server
        .get<{
            Querystring: {
                username: string;
                password: string;
            },
        }>
        ('/', async (request, reply) => {
            const { username, password } = request.query
            return reply.view('main', {
                title: 'Dashboard',
                u: username + (index++).toString(),
                password
            });
            // await reply.send({ data: username + password });
        })
}
