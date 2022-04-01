import * as yaml from 'js-yaml';

import { RouterOptions, RouterYamlV1 } from './types';
import { validateObject } from '../../../common/lib/ajv';

export const getV1Yaml = (resourceId: string, options: RouterOptions): string => {
    const yamlObj: RouterYamlV1 = {
        kind: 'router',
        api: 'v1',
        meta: {
            id: resourceId,
        },
        spec: options
    }
    return yaml.dump(yamlObj);
}

export const getLatestYaml = (resourceId: string, options: RouterOptions): string => {
    return getV1Yaml(resourceId, options);
}
type TryParseYamlResult = { resourceId: string, options: RouterOptions };
export const tryParseYaml = (yamlData: Buffer): TryParseYamlResult[] => {
    if (!yamlData.length)
        throw new Error('Empty YAML data');

    let objs: object[] = [];
    try { objs = yaml.loadAll(yamlData.toString()) as object[]; }
    catch (error) { throw new Error('Invalid YAML format'); }

    const result = [];
    for (const obj of objs) {
        const yamlV1 = validateObject<RouterYamlV1>(RouterYamlV1, obj);
        if (yamlV1)
            result.push({ resourceId: yamlV1.meta.id, options: yamlV1.spec });
    }
    return result;
}
