import logger from './logger';
import { IStorage, MessageStorageItem, StorageResourceType } from "./storage/IStorage";
import { IResource } from "./resources/IResource";
import { Router, RouterOptions } from './resources/Router';
import { validateObject } from '../common/lib/ajv';

type ResourceType = StorageResourceType;
const ResourceType = StorageResourceType;

const log = logger.child({ module: 'Messages' });

export type RouterResult = {
    newTopics: string[],
    removeOriginal: boolean,
    noOperationNeed: boolean;
}

export class ResourceHandler {
    private resources: Map<ResourceType, IResource[]>;
    private storage: IStorage;

    constructor(storage: IStorage) {
        this.resources = new Map<ResourceType, IResource[]>();
        this.storage = storage;

        this.init();
    }




    // Public

    public adaptRouter(msg: MessageStorageItem): RouterResult {
        const routerList = (this.resources.get('router') || []) as Router[];

        const result: RouterResult = { newTopics: [msg.topic], removeOriginal: true, noOperationNeed: true };
        let newTopicsLastCount = 0;

        while (newTopicsLastCount < result.newTopics.length) {
            for (const topic of result.newTopics)
                for (const router of routerList)
                    if (router.matchTopic(topic)) {
                        const { copyTo, moveTo } = router.getOutputTopics();
                        if (copyTo.length) {
                            for (const copyToItem of copyTo)
                                if (!result.newTopics.includes(copyToItem))
                                    result.newTopics.push(copyToItem);
                            result.removeOriginal = false;
                        }
                        if (moveTo.length) {
                            for (const moveToItem of moveTo)
                                if (!result.newTopics.includes(moveToItem))
                                    result.newTopics.push(moveToItem);
                        }
                        result.noOperationNeed = false;
                    }

            newTopicsLastCount = result.newTopics.length;
        }

        return result;
    }




    // Private

    private init() {
        for (const rt of ResourceType) {
            if (!this.resources.has(rt))
                this.resources.set(rt, []);

            const resList = this.resources.get(rt) || [];
            const storageResList = this.storage.getResources(rt);
            for (const storageResItem of storageResList) {
                const resourceName = storageResItem[0];
                const optionsStr = storageResItem[1];
                try {
                    switch (rt) {
                        case "router":
                            const optionsObj = validateObject<RouterOptions>(RouterOptions, JSON.parse(optionsStr), true);
                            if (optionsObj)
                                resList.push(new Router(optionsObj));
                            break;
                        case "validator":
                            break;
                    }
                    log.info({ resourceName }, `Init ${rt} resource`);
                }
                catch (error) {
                    log.error({ resourceName, error: error instanceof Error ? error.message : '' }, `Init ${rt} resource failed`);
                }
            }
        }
    }
}