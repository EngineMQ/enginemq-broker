import { Packr } from 'msgpackr';
import { createClient } from 'redis';
import { awaitSync } from '@kaciras/deasync';

import * as config from '../../config';
import { IStorage, MessageStorageItem, ResourceType } from './IStorage';
import logger from '../logger';
import { RedisClientType } from '@node-redis/client';

class RedisStorageError extends Error { }

const log = logger.child({ module: 'RedisStorage' });
const KEYNAME = `${config.serviceName}-messages`;

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
        const allMessageCount = awaitSync(this.redis.hLen(KEYNAME));
        log.debug({ count: allMessageCount }, 'Find messages');
        callbackProgress.total(allMessageCount);

        void (async () => {
            if (allMessageCount) {
                let index = 0;
                let size = 0;
                for await (const { field, value } of this.redis.hScanIterator(KEYNAME, { COUNT: 256 })) {
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
            new TextEncoder().encode()
            awaitSync(this.redis.hSet(KEYNAME, messageId, databaseData.toString('binary')));
            log.debug({ messageId, size: databaseData.length }, 'Store message');
        } catch (error) { throw new RedisStorageError(`Cannot create message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            awaitSync(this.redis.hDel(KEYNAME, messageId));
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new RedisStorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    getResources(type: ResourceType): { resourceId: string, optionjson: string }[] { type; return [] }
    addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void { type; resourceId; optionjson; }
    deleteResource(type: ResourceType, resourceId: string): void { type; resourceId; }

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