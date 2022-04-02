import logger from './logger';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { Router } from './resources/router/Router';
import { validateObject } from '../common/lib/ajv';
import { customAlphabet } from 'nanoid';
import { RouterOptions } from './resources/router/types';
import { tryParseYaml } from './resources/router/yaml';

const log = logger.child({ module: 'Messages' });

const RESOURCE_ID_LENGTH = 20;
const genResourceId = () => customAlphabet('0123456789abcdef', RESOURCE_ID_LENGTH)();

export const resourceIdRegExp = `^[0-9a-f]{${RESOURCE_ID_LENGTH}}$`;

export class ResourceHandler {
    private routers = new Map<string, Router>();
    private storage: IStorage;

    constructor(storage: IStorage) {
        this.storage = storage;
        this.init();
    }




    // Public

    public adaptRouter(message: MessageStorageItem): string[] {
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

        return resourceId;
    }

    public updateRouter(resourceId: string, options: RouterOptions) {
        const router = this.routers.get(resourceId);
        if (!router)
            throw new Error(`Router '${resourceId}' not found`);

        router.setOptions(options);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), undefined, 2));
    }

    public deleteRouter(resourceId: string) {
        this.routers.delete(resourceId);
        this.storage.deleteResource('router', resourceId);
    }

    public deleteAllRouter() {
        for (const resourceId of this.routers.keys()) {
            this.routers.delete(resourceId);
            this.storage.deleteResource('router', resourceId);
        }
    }

    public adaptRouterFromYaml(yaml: Buffer) {
        const routersData = tryParseYaml(yaml);
        if (routersData.length === 0)
            throw new Error('No valid router found in YAML');

        for (const routerData of routersData)
            if (new RegExp(resourceIdRegExp).test(routerData.resourceId))
                if (this.routers.get(routerData.resourceId))
                    this.updateRouter(routerData.resourceId, routerData.options);
                else
                    this.addRouter(routerData.options, routerData.resourceId);
    }



    // Private

    private init() {
        for (const storageResource of this.storage.getResources('router')) {
            try {
                const optionsObject = validateObject<RouterOptions>(RouterOptions, JSON.parse(storageResource.optionjson), true);
                if (optionsObject) {
                    const router = new Router(optionsObject);
                    this.routers.set(storageResource.resourceId, router);
                    log.info({ resourceName: router.description }, 'Init router resource');
                }
            }
            catch (error) {
                log.error({ resourceName: storageResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init router resource failed');
            }
        }
    }

}