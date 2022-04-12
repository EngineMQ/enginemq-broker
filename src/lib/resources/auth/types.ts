import { Static, Type } from '@sinclair/typebox';

import { TOPIC_LENGTH_MAX, TOPIC_MASK } from '../../../common/messageTypes';
import { trimStringFields } from '../../utility';
import { AUTHTOKEN_LENGTH_MAX, AUTHTOKEN_MASK_REGEXP } from './Auth';

const DESCRIPTION_LENGTH_MAX = 80;
const TOPICS_MAX_ITEMS = 32;

export type AuthOptions = Static<typeof AuthOptions>;
export const AuthOptions = Type.Object({
    description: Type.String(),
    token: Type.String(),
    webAccess: Type.Boolean({ default: false }),
    publishTo: Type.Optional(
        Type.Union([
            Type.String(),
            Type.Array(Type.String())
        ])),
    subscribeTo: Type.Optional(
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

    if (!options.token)
        throw new Error('Validation error: token mandatory');
    if (!AUTHTOKEN_MASK_REGEXP.test(options.token))
        throw new Error('Validation error: invalid token format');
    if (options.token.length > AUTHTOKEN_LENGTH_MAX)
        throw new Error('Validation error: topic too long');

    for (const targets of [options.publishTo, options.subscribeTo])
        if (targets)
            if (Array.isArray(targets)) {
                if (targets.length > TOPICS_MAX_ITEMS)
                    throw new Error('Validation error: too much target topics');
                for (const target of targets) {
                    if (!TOPIC_MASK.test(target))
                        throw new Error(`Validation error: invalid topic format ${target}`);
                    if (target.length > TOPIC_LENGTH_MAX)
                        throw new Error(`Validation error: topic too long ${target}`);
                }
            }
            else {
                if (!TOPIC_MASK.test(targets))
                    throw new Error(`Validation error: invalid topic format ${targets}`);
                if (targets.length > TOPIC_LENGTH_MAX)
                    throw new Error(`Validation error: topic too long ${targets}`);
            }
}