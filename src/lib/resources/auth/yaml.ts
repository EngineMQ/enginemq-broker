import * as yaml from 'js-yaml';

import { AuthOptions, AuthYamlV1 } from './types';
import { validateObject } from '../../../common/lib/ajv';

export const getV1Yaml = (resourceId: string, options: AuthOptions): string => {
    const yamlObject: AuthYamlV1 = {
        kind: 'auth',
        api: 'v1',
        meta: {
            id: resourceId,
        },
        spec: options
    }
    return yaml.dump(yamlObject);
}

export const getLatestYaml = (resourceId: string, options: AuthOptions): string => {
    return getV1Yaml(resourceId, options);
}

type TryParseYamlResult = { resourceId: string, options: AuthOptions };
export const tryParseYaml = (yamlObjects: object[]): TryParseYamlResult[] => {
    const result = [];
    for (const object of yamlObjects) {
        const yamlV1 = validateObject<AuthYamlV1>(AuthYamlV1, object);
        if (yamlV1)
            result.push({ resourceId: yamlV1.meta.id, options: yamlV1.spec });
    }
    return result;
}
