import logger from './logger';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { Router, RouterOptions } from './resources/Router';
import { validateObject } from '../common/lib/ajv';
import { customAlphabet } from 'nanoid';

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

    public adaptRouter(msg: MessageStorageItem): string[] {
        const visitedTopics: string[] = [];
        const runRouter = (topic: string): string[] => {
            visitedTopics.push(topic);

            const result: string[] = [];

            const applicableRouters = Array.from(this.routers.values()).filter((router) => router.matchTopic(topic));
            let removeTopic = applicableRouters.length > 0;

            for (const router of applicableRouters) {
                const output = router.getOutputTopics();
                if (output.holdOriginal)
                    removeTopic = false;
                for (const subTopic of output.topics)
                    if (visitedTopics.includes(subTopic))
                        log.warn({ topic, subTopic }, 'Circular routing detected');
                    else
                        result.push(...runRouter(subTopic));
            }

            if (!removeTopic)
                result.push(topic);
            return result;
        }
        return runRouter(msg.topic).sort();
    }

    public getRouters() {
        return this.routers;
    }

    public addRouter(options: RouterOptions): string {
        const resourceId = genResourceId();

        const router = new Router(options);
        this.routers.set(resourceId, router);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), null, 2));

        return resourceId;
    }

    public updateRouter(resourceId: string, options: RouterOptions) {
        const router = this.routers.get(resourceId);
        if (!router)
            throw new Error(`Router ${resourceId} not found`);

        router.setOptions(options);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), null, 2));
    }

    public deleteRouter(resourceId: string) {
        this.routers.delete(resourceId);
        this.storage.deleteResource('router', resourceId);
    }



    // Private

    private init() {
        for (const storageResource of this.storage.getResources('router')) {
            try {
                const optionsObj = validateObject<RouterOptions>(RouterOptions, JSON.parse(storageResource.optionjson), true);
                if (optionsObj) {
                    const router = new Router(optionsObj);
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