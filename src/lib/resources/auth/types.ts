import { Static, Type } from '@sinclair/typebox';

import { TOPIC_LENGTH_MAX, TOPIC_MASK } from '../../../common/messageTypes';
import { trimStringFields } from '../../utility';

const DESCRIPTION_LENGTH_MAX = 80;
const TOPICS_MAX_ITEMS = 32;

export type AuthOptions = Static<typeof AuthOptions>;
export const AuthOptions = Type.Object({
    description: Type.String(),
    topic: Type.String(),
    moveTo: Type.Optional(
        Type.Union([
            Type.String(),
            Type.Array(Type.String())
        ])),
    copyTo: Type.Optional(
        Type.Union([
            Type.String(),
            Type.Array(Type.String())
        ])),
});

export type AuthYamlV1 = Static<typeof AuthYamlV1>;
export const AuthYamlV1 = Type.Object({
    kind: Type.Literal('auth'),
    api: Type.Literal('v1'),
    meta: Type.Object({
        id: Type.String(),
    }),
    spec: AuthOptions,
});

export const validateOptions = (options: AuthOptions) => {
    trimStringFields(options);

    if (!options.description)
        throw new Error('Validation error: description mandatory');
    if (options.description.length > DESCRIPTION_LENGTH_MAX)
        throw new Error(`Validation error: description too long'${options.description}'`);

    // if (!options.topic)
    //     throw new Error('Validation error: topic mandatory');
    // if (!TOPIC_MASK.test(options.topic))
    //     throw new Error('Validation error: invalid topic format');
    // if (options.topic.length > TOPIC_LENGTH_MAX)
    //     throw new Error('Validation error: topic too long');

    // if (!(options.copyTo && options.copyTo.length > 0 || options.moveTo && options.moveTo.length > 0))
    //     throw new Error('Validation error: copyTo or moveTo is mandatory');

    // for (const targets of [options.copyTo, options.moveTo])
    //     if (targets)
    //         if (Array.isArray(targets)) {
    //             if (targets.length > ROUTE_MAX_ITEMS)
    //                 throw new Error('Validation error: too much target topics');
    //             for (const target of targets) {
    //                 if (!TOPIC_MASK.test(target))
    //                     throw new Error(`Validation error: invalid topic format ${target}`);
    //                 if (target.length > TOPIC_LENGTH_MAX)
    //                     throw new Error(`Validation error: topic too long ${target}`);
    //             }
    //         }
    //         else {
    //             if (!TOPIC_MASK.test(targets))
    //                 throw new Error(`Validation error: invalid topic format ${targets}`);
    //             if (targets.length > TOPIC_LENGTH_MAX)
    //                 throw new Error(`Validation error: topic too long ${targets}`);
    //         }
}