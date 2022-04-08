import Ajv from 'ajv';
import { Static, Type } from '@sinclair/typebox';

import { TOPIC_LENGTH_MAX, TOPIC_MASK } from '../../../common/messageTypes';
import { trimStringFields } from '../../utility';

const DESCRIPTION_LENGTH_MAX = 80;
const TOPICS_MAX_ITEMS = 32;

export const ValidatorSampleSchema = {
    type: 'object',
    properties: {
        foo: { type: 'string' },
        bar: {
            type: 'object',
            properties: {
                baz: { type: 'string' },
            },
            additionalProperties: false,
        }
    }
}
export type ValidatorOptions = Static<typeof ValidatorOptions>;
export const ValidatorOptions = Type.Object({
    description: Type.String(),
    topics: Type.Union([
        Type.String(),
        Type.Array(Type.String())
    ]),
    schema: Type.Object({}),
});

export type ValidatorYamlV1 = Static<typeof ValidatorYamlV1>;
export const ValidatorYamlV1 = Type.Object({
    kind: Type.Literal('validator'),
    api: Type.Literal('v1'),
    meta: Type.Object({
        id: Type.String(),
    }),
    spec: ValidatorOptions,
});

export const validateOptions = (options: ValidatorOptions) => {
    trimStringFields(options);

    if (!options.description)
        throw new Error('Validation error: description mandatory');
    if (options.description.length > DESCRIPTION_LENGTH_MAX)
        throw new Error(`Validation error: description too long'${options.description}'`);

    if (!(options.topics && options.topics.length > 0))
        throw new Error('Validation error: topics is mandatory');

    if (options.topics)
        if (Array.isArray(options.topics)) {
            if (options.topics.length > TOPICS_MAX_ITEMS)
                throw new Error('Validation error: too much topics');
            for (const topic of options.topics) {
                if (!TOPIC_MASK.test(topic))
                    throw new Error(`Validation error: invalid topic format ${topic}`);
                if (topic.length > TOPIC_LENGTH_MAX)
                    throw new Error(`Validation error: topic too long ${topic}`);
            }
        }
        else {
            if (!TOPIC_MASK.test(options.topics))
                throw new Error(`Validation error: invalid topic format ${options.topics}`);
            if (options.topics.length > TOPIC_LENGTH_MAX)
                throw new Error(`Validation error: topic too long ${options.topics}`);
        }

    try { CreateAjvValidator().compile(options.schema); }
    catch (error) { throw new Error(`Invalid schema: ${error instanceof Error ? error.message : ''} `); }
}

export const CreateAjvValidator = () => {
    return new Ajv({
        coerceTypes: true,
        useDefaults: true,
    })
        .addKeyword('kind')
        .addKeyword('modifier');
}