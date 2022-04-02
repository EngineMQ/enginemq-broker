import * as yaml from 'js-yaml';

import { RouterOptions, RouterYamlV1 } from './types';
import { validateObject } from '../../../common/lib/ajv';

export const getV1Yaml = (resourceId: string, options: RouterOptions): string => {
    const yamlObject: RouterYamlV1 = {
        kind: 'router',
        api: 'v1',
        meta: {
            id: resourceId,
        },
        spec: options
    }
    return yaml.dump(yamlObject);
}

export const getLatestYaml = (resourceId: string, options: RouterOptions): string => {
    return getV1Yaml(resourceId, options);
}
type TryParseYamlResult = { resourceId: string, options: RouterOptions };
export const tryParseYaml = (yamlData: Buffer): TryParseYamlResult[] => {
    if (yamlData.length === 0)
        throw new Error('Empty YAML data');

    let objs: object[] = [];
    try { objs = yaml.loadAll(yamlData.toString()) as object[]; }
    catch { throw new Error('Invalid YAML format'); }

    const result = [];
    for (const object of objs) {
        const yamlV1 = validateObject<RouterYamlV1>(RouterYamlV1, object);
        if (yamlV1)
            result.push({ resourceId: yamlV1.meta.id, options: yamlV1.spec });
    }
    return result;
}
