import * as yaml from 'js-yaml';

import { ValidatorOptions, ValidatorYamlV1 } from './types';
import { validateObject } from '../../../common/lib/ajv';

export const getV1Yaml = (resourceId: string, options: ValidatorOptions): string => {
    const yamlObject: ValidatorYamlV1 = {
        kind: 'validator',
        api: 'v1',
        meta: {
            id: resourceId,
        },
        spec: options
    }
    return yaml.dump(yamlObject);
}

export const getLatestYaml = (resourceId: string, options: ValidatorOptions): string => {
    return getV1Yaml(resourceId, options);
}

type TryParseYamlResult = { resourceId: string, options: ValidatorOptions };
export const tryParseYaml = (yamlObjects: object[]): TryParseYamlResult[] => {
    const result = [];
    for (const object of yamlObjects) {
        const yamlV1 = validateObject<ValidatorYamlV1>(ValidatorYamlV1, object);
        if (yamlV1)
            result.push({ resourceId: yamlV1.meta.id, options: yamlV1.spec });
    }
    return result;
}
