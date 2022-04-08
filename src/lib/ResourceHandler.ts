import * as yaml from 'js-yaml';

import logger from './logger';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { validateObject } from '../common/lib/ajv';
import { customAlphabet } from 'nanoid';

import { Router } from './resources/router/Router';
import { RouterOptions } from './resources/router/types';
import { tryParseYaml as tryParseRouterYaml } from './resources/router/yaml';

const log = logger.child({ module: 'Resources' });

const RESOURCE_ID_LENGTH = 20;
const genResourceId = () => customAlphabet('0123456789abcdef', RESOURCE_ID_LENGTH)();

export const resourceIdRegExp = `^[0-9a-f]{${RESOURCE_ID_LENGTH}}$`;

export type ResourceType = 'validator' | 'router';

export class ResourceHandler {
    private routers = new Map<string, Router>();
    private storage: IStorage;

    constructor(storage: IStorage) {
        this.storage = storage;
        this.init();
    }




    // Public

    public adaptFromYaml(yamlData: Buffer) {
        if (yamlData.length === 0)
            throw new Error('Empty YAML data');

        let objs: object[] = [];
        try { objs = yaml.loadAll(yamlData.toString()) as object[]; }
        catch { throw new Error('Invalid YAML format'); }

        let resourceCount = 0;
        for (const routerData of tryParseRouterYaml(objs)) {
            resourceCount++;
            if (new RegExp(resourceIdRegExp).test(routerData.resourceId))
                if (this.routers.get(routerData.resourceId))
                    this.updateRouter(routerData.resourceId, routerData.options);
                else
                    this.addRouter(routerData.options, routerData.resourceId);
        }
        log.info({ count: resourceCount }, 'Resources adopted from yaml');
    }

    public deleteAllResource() {
        this.deleteAllRouter();
        log.info('All resources deleted');
    }



    // Routers

    public runRouterChain(message: MessageStorageItem): string[] {
        const visitedTopics: string[] = [];
        const runRouter = (topic: string): string[] => {
            visitedTopics.push(topic);

            const result: string[] = [];

            const applicableRouters = [...this.routers.values()].filter((router) => router.matchTopic(topic));
            let removeTopic = applicableRouters.length > 0;

            for (const router of applicableRouters) {
                const output = router.getOutputTopics();
                if (output.holdOriginal)
                    removeTopic = false;
                for (const subTopic of output.topics) {
                    if (visitedTopics.includes(subTopic))
                        throw new Error(`Circular routing detected: from ${topic} to ${subTopic}`);
                    result.push(...runRouter(subTopic));
                }
            }

            if (!removeTopic)
                result.push(topic);
            return result;
        }
        return runRouter(message.topic).sort();
    }

    public getRouters() {
        return this.routers;
    }

    public addRouter(options: RouterOptions, resourceId?: string): string {
        if (!resourceId)
            resourceId = genResourceId();

        const router = new Router(options);
        this.routers.set(resourceId, router);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Router added');

        return resourceId;
    }

    public updateRouter(resourceId: string, options: RouterOptions) {
        const router = this.routers.get(resourceId);
        if (!router)
            throw new Error(`Router '${resourceId}' not found`);

        router.setOptions(options);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Router updated');
    }

    public deleteRouter(resourceId: string) {
        this.routers.delete(resourceId);
        this.storage.deleteResource('router', resourceId);

        log.info({ resourceId }, 'Router deleted');
    }

    public deleteAllRouter() {
        for (const resourceId of this.routers.keys()) {
            this.routers.delete(resourceId);
            this.storage.deleteResource('router', resourceId);
        }
        log.info('All routers deleted');
    }



    // Private

    private init() {
        for (const storageResource of this.storage.getResources('router')) {
            try {
                const optionsObject = validateObject<RouterOptions>(RouterOptions, JSON.parse(storageResource.optionjson), true);
                if (optionsObject) {
                    const router = new Router(optionsObject);
                    this.routers.set(storageResource.resourceId, router);
                    log.info({ resourceName: router.description }, 'Init router');
                }
            }
            catch (error) {
                log.error({ resourceName: storageResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init router failed');
            }
        }
    }

}