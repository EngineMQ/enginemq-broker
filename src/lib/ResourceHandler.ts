import logger from './logger';
import { IStorage, MessageStorageItem } from "./storage/IStorage";
import { Router, RouterOptions } from './resources/Router';
import { validateObject } from '../common/lib/ajv';

const log = logger.child({ module: 'Messages' });

export class ResourceHandler {
    private routers: Router[] = [];
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

            const applicableRouters = this.routers.filter((router) => router.matchTopic(topic));
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




    // Private

    private init() {
        for (const storageResource of this.storage.getResources('router')) {
            try {
                const optionsObj = validateObject<RouterOptions>(RouterOptions, JSON.parse(storageResource.optionjson), true);
                if (optionsObj) {
                    const router = new Router(optionsObj);
                    this.routers.push(router);
                    log.info({ resourceName: router.name }, 'Init router resource');
                }
            }
            catch (error) {
                log.error({ resourceName: storageResource.name, error: error instanceof Error ? error.message : '' }, 'Init router resource failed');
            }
        }
    }

}