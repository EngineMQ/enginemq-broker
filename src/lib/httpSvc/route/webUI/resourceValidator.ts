import { FastifyInstance } from 'fastify';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import resourceServiceValidator from '../../services/resourceServiceValidator';
import { reduceArrayIfOneItem, yamlAdaptDateTimeHeader } from '../../../utility';
import { resourceIdRegExp } from '../../../ResourceHandler';
import { BREADCRUMB_TO_LIST } from './resource';
import { ValidatorOptions, ValidatorSampleSchema } from '../../../resources/validator/types';

const HTTP_NOT_FOUND = 404;

const validatorOptionsToString = (options: ValidatorOptions) => {
    return {
        description: options.description,
        topics: options.topics,
        schema: yamlDump(options.schema),
    }
}

export default (server: FastifyInstance) => {
    server

        .get('/resources/validators/yaml', async (_request, reply) => {
            const yamlAll = resourceServiceValidator.getAllValidatorsYaml();
            if (yamlAll)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', 'attachment; filename=validators.yaml')
                    .send(yamlAdaptDateTimeHeader(yamlAll));
            return reply.code(HTTP_NOT_FOUND).send('Cannot find any validator');
        })

        .get<{ Params: { resourceId: string } }>(`/resources/validator/:resourceId(${resourceIdRegExp})`, async (request, reply) => {
            const { resourceId } = request.params;
            const validator = resourceServiceValidator.getValidator(resourceId);
            if (validator) {
                const options = validator.getOptions()
                return reply.view('resources/validatorEdit', {
                    title: 'Validator',
                    subtitle: validator.description,
                    breadcrumb: BREADCRUMB_TO_LIST,
                    resourceId,
                    validator: validatorOptionsToString(options),
                });
            }
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find validator ${resourceId}`);
        })

        .get<{ Params: { resourceId: string } }>(`/resources/validator/:resourceId(${resourceIdRegExp})/yaml`, async (request, reply) => {
            const { resourceId } = request.params;
            const validator = resourceServiceValidator.getValidator(resourceId);
            if (validator)
                return reply
                    .type('text/yaml')
                    .header('Content-Disposition', `attachment; filename=${resourceId}.yaml`)
                    .send(yamlAdaptDateTimeHeader(validator.getYaml(resourceId)));
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find validator ${resourceId}`);
        })

        .get('/resources/validators/new', async (_request, reply) => {
            return reply.view('resources/validatorEdit', {
                title: 'New validator',
                breadcrumb: BREADCRUMB_TO_LIST,
                resourceId: '',
                validator: validatorOptionsToString({
                    description: '',
                    topics: '',
                    schema: ValidatorSampleSchema,
                }),
            });
        })

        .get<{ Params: { resourceId: string } }>(`/resources/validators/copy/:resourceId(${resourceIdRegExp})`, async (request, reply) => {
            const { resourceId } = request.params;
            const validator = resourceServiceValidator.getValidator(resourceId);
            if (validator) {
                const options = { ...validator.getOptions() };
                options.description = 'Copy of ' + options.description;
                return reply.view('resources/validatorEdit', {
                    title: 'Validator',
                    subtitle: validator.description,
                    breadcrumb: BREADCRUMB_TO_LIST,
                    resourceId: '',
                    validator: validatorOptionsToString(options),
                });
            }
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find validator ${resourceId}`);
        })

        .post<{
            Body: {
                resourceId: string,
                description: string,
                topics: string,
                schema: string,
            }
        }>('/resources/validators/update', async (request, reply) => {
            const { resourceId, description, topics, schema } = request.body;
            let schemaObject = {};
            try {
                schemaObject = yamlLoad(schema) as object;
            }
            catch { throw new Error('Invalid Yaml format'); }
            resourceServiceValidator.insertOrUpdateValidator(resourceId, {
                description,
                topics: reduceArrayIfOneItem(topics.split('\r\n').filter(Boolean)),
                schema: schemaObject,
            });
            return reply.send('OK');
        })

        .post<{ Body: { resourceId: string } }>('/resources/validators/delete', async (request, reply) => {
            const { resourceId } = request.body;
            resourceServiceValidator.deleteValidator(resourceId);
            return reply.send('OK');
        })

        .post('/resources/validators/delete/all', async (_request, reply) => {
            resourceServiceValidator.deleteAllValidator();
            return reply.send('OK');
        })

}
