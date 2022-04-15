import { FastifyInstance } from 'fastify'

const HTTP_302 = 302;

export default (server: FastifyInstance) => {

    server
        .get('/', async (request, reply) => {
            if (!Context.ResourceHandler.isAnonymousWebUiMode() && !request.session.data['auth'])
                return reply.view('login', {
                    title: 'Login',
                });
            return reply.view('main', {
                title: 'Dashboard',
            });
        })

        .post<{ Body: { token: string } }>('/login', async (request, reply) => {
            const { token } = request.body;

            const auth = Context.ResourceHandler.getAuthByToken(token);
            if (!auth)
                throw new Error('Invalid token');

            request.session.data['auth'] = { token: token };
            await request.session.save();

            return reply.send('OK');
        })

        .get('/logout', async (request, reply) => {
            delete request.session.data['auth'];
            await request.session.save();

            return reply.redirect(HTTP_302, '/');
        })

}
