import { FastifyInstance } from 'fastify';
import resourceServiceAuth from '../../services/resourceServiceAuth';
import { reduceArrayIfOneItem, yamlAdaptDateTimeHeader } from '../../../utility';
import { resourceIdRegExp } from '../../../ResourceHandler';
import { BREADCRUMB_TO_LIST } from './resource';

const HTTP_NOT_FOUND = 404;

export default (server: FastifyInstance) => {
    server

        .get('/resources/auths/yaml', async (_request, reply) => {
            const yamlAll = resourceServiceAuth.getAllAuthYaml();
            if (yamlAll)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', 'attachment; filename=auths.yaml')
                    .send(yamlAdaptDateTimeHeader(yamlAll));
            return reply.code(HTTP_NOT_FOUND).send('Cannot find any auth');
        })

        .get<{ Params: { resourceId: string } }>(`/resources/auth/:resourceId(${resourceIdRegExp})`, async (request, reply) => {
            const { resourceId } = request.params;
            const auth = resourceServiceAuth.getAuth(resourceId);
            if (auth)
                return reply.view('resources/authEdit', {
                    title: 'Auth',
                    subtitle: auth.description,
                    breadcrumb: BREADCRUMB_TO_LIST,
                    resourceId,
                    auth: auth.getOptions(),
                });
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find auth ${resourceId}`);
        })

        .get<{ Params: { resourceId: string } }>(`/resources/auth/:resourceId(${resourceIdRegExp})/yaml`, async (request, reply) => {
            const { resourceId } = request.params;
            const auth = resourceServiceAuth.getAuth(resourceId);
            if (auth)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', `attachment; filename=${resourceId}.yaml`)
                    .send(yamlAdaptDateTimeHeader(auth.getYaml(resourceId)));
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find auth ${resourceId}`);
        })

        .get('/resources/auths/new', async (_request, reply) => {
            return reply.view('resources/authEdit', {
                title: 'New auth',
                breadcrumb: BREADCRUMB_TO_LIST,
                resourceId: '',
                auth: {
                    description: '',
                    token: resourceServiceAuth.generateNewUniqueToken(),
                    webAccess: false,
                    publishTo: '',
                    subscribeTo: '',
                }
            });
        })

        .get<{ Params: { resourceId: string } }>(`/resources/auths/copy/:resourceId(${resourceIdRegExp})`, async (request, reply) => {
            const { resourceId } = request.params;
            const auth = resourceServiceAuth.getAuth(resourceId);
            if (auth) {
                const options = { ...auth.getOptions() };
                options.description = 'Copy of ' + options.description;
                return reply.view('resources/authEdit', {
                    title: 'Auth',
                    subtitle: auth.description,
                    breadcrumb: BREADCRUMB_TO_LIST,
                    resourceId: '',
                    auth: Object.assign(options, { token: resourceServiceAuth.generateNewUniqueToken(), }),
                });
            }
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find auth ${resourceId}`);
        })

        .post<{
            Body: {
                resourceId: string,
                description: string,
                token: string,
                webaccess: boolean,
                publishTo: string,
                subscribeTo: string
            }
        }>('/resources/auths/update', async (request, reply) => {
            const { resourceId, description, token, webaccess, publishTo, subscribeTo } = request.body;
            resourceServiceAuth.insertOrUpdateAuth(resourceId, {
                description,
                webAccess: webaccess,
                token,
                publishTo: reduceArrayIfOneItem(publishTo.split('\r\n').filter(Boolean)),
                subscribeTo: reduceArrayIfOneItem(subscribeTo.split('\r\n').filter(Boolean)),
            });
            return reply.send('OK');
        })

        .post<{ Body: { resourceId: string } }>('/resources/auths/delete', async (request, reply) => {
            const { resourceId } = request.body;
            resourceServiceAuth.deleteAuth(resourceId);
            return reply.send('OK');
        })

        .post('/resources/auths/delete/all', async (_request, reply) => {
            resourceServiceAuth.deleteAllAuth();
            return reply.send('OK');
        })

}
