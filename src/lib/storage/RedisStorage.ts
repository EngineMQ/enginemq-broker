import { Packr } from 'msgpackr';
import { createClient } from 'redis';
import { awaitSync } from '@kaciras/deasync';

import * as config from '../../config';
import { IStorage, MessageStorageItem, ResourceList, ResourceType } from './IStorage';
import logger from '../logger';
import { RedisClientType } from '@node-redis/client';

class RedisStorageError extends Error { }

const log = logger.child({ module: 'RedisStorage' });
const KEYNAME_MESSAGE = `${config.serviceName}-message`;
const KEYNAME_RESOURCES = (type: ResourceType) => `${config.serviceName}-resource-${type}`;

export class RedisStorage implements IStorage {
    private _redis: RedisClientType | undefined = undefined;
    private redis: RedisClientType;
    private packr = new Packr();

    constructor(connection: string) {
        log.info({ connection }, 'Init Redis connection');
        this.init(connection);

        if (this._redis)
            this.redis = this._redis;
        else
            throw new RedisStorageError();
    }



    // Public

    public getAllMessages(
        target: MessageStorageItem[],
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        callbackReady: () => void,
    ): void {
        const REPORT_ITEMS = 10_000;
        const allMessageCount = awaitSync(this.redis.hLen(KEYNAME_MESSAGE));
        log.debug({ count: allMessageCount }, 'Find messages');
        callbackProgress.total(allMessageCount);

        void (async () => {
            if (allMessageCount) {
                let index = 0;
                let size = 0;
                for await (const { field, value } of this.redis.hScanIterator(KEYNAME_MESSAGE, { COUNT: 256 })) {
                    if (typeof field === 'string') {
                        const valueBuffer = Buffer.from(value, 'binary');
                        size += valueBuffer.length;

                        let fileObject: MessageStorageItem;
                        try {
                            fileObject = this.packr.unpack(valueBuffer) as MessageStorageItem;
                        } catch (error) { throw new Error(`Cannot decode file (maybe damaged) ${field}: ` + (error instanceof Error ? error.message : '')) }
                        target.push(fileObject);

                        if (++index % REPORT_ITEMS == 0)
                            callbackProgress.percent(index, Math.round(100 * index / allMessageCount), size);
                    }
                }
                callbackProgress.percent(allMessageCount, 100, size);
            }
            callbackReady();
        })();
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const databaseData = this.packr.pack(message);
            awaitSync(this.redis.hSet(KEYNAME_MESSAGE, messageId, databaseData.toString('binary')));
            log.debug({ messageId, size: databaseData.length }, 'Store message');
        } catch (error) { throw new RedisStorageError(`Cannot create message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            awaitSync(this.redis.hDel(KEYNAME_MESSAGE, messageId));
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new RedisStorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    public async getResources(type: ResourceType): Promise<ResourceList> {
        try {
            const resources = [];
            for await (const { field, value } of this.redis.hScanIterator(KEYNAME_RESOURCES(type), { COUNT: 256 })) {
                if (typeof field === 'string')
                    resources.push({ resourceId: field, optionjson: value });
            }
            return resources;
        } catch (error) { throw new RedisStorageError(`Cannot load resources '${type}': ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void {
        try {
            // awaitSync(this.redis.hSet(KEYNAME_RESOURCES(type), resourceId, optionjson));
            void this.redis.hSet(KEYNAME_RESOURCES(type), resourceId, optionjson);
            log.debug({ type, resourceId }, 'Store resource');
        } catch (error) { throw new RedisStorageError(`Cannot store ${type} resource '${resourceId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteResource(type: ResourceType, resourceId: string): void {
        try {
            // awaitSync(this.redis.hDel(KEYNAME_RESOURCES(type), resourceId));
            void this.redis.hDel(KEYNAME_RESOURCES(type), resourceId);
            log.debug({ type, resourceId }, 'Delete resource');
        } catch (error) { throw new RedisStorageError(`Cannot delete ${type} resource '${resourceId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public close(): void {
        awaitSync(this.redis.quit());
    }



    // Private

    private init(connection: string) {
        void (async () => {
            try {
                this._redis = createClient({
                    url: connection,
                    name: config.serviceName,
                });
                await this._redis.connect();
                this._redis.on('error', (error) => log.error(error));
            }
            catch (error) { throw new RedisStorageError(`Error initial connection to redis '${connection}': ${error instanceof Error ? error.message : ''}`); }
        })();
    }
}