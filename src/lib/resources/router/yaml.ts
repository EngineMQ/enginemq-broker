import * as yaml from 'js-yaml';

import { RouterOptions, RouterYamlV1 } from './types';
//import { validateObject } from '../../common/lib/ajv';

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
