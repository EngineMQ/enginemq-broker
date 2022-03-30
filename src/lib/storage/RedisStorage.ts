import { Packr } from 'msgpackr';
import { createClient } from 'redis';
import { awaitSync } from '@kaciras/deasync';

import * as config from '../../config';
import { IStorage, MessageStorageItem, StorageResourceType } from "./IStorage";
import logger from '../logger';
import { RedisClientType } from '@node-redis/client';

class RedisStorageError extends Error { }

const log = logger.child({ module: 'RedisStorage' });
const KEYNAME = `${config.serviceName}-messages`;

export class RedisStorage implements IStorage {
    private _redis: RedisClientType | null = null;
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
        cbProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        cbReady: () => void,
    ): void {
        const REPORT_ITEMS = 10000;
        const allMessageCount = awaitSync(this.redis.hLen(KEYNAME));
        log.debug({ count: allMessageCount }, 'Find messages');
        cbProgress.total(allMessageCount);

        void (async () => {
            if (allMessageCount) {
                let index = 0;
                let size = 0;
                for await (const { field, value } of this.redis.hScanIterator(KEYNAME, { COUNT: 256 })) {
                    if (typeof field === 'string') {
                        const valueBuffer = Buffer.from(value, 'binary');
                        size += valueBuffer.length;

                        let fileObj: MessageStorageItem;
                        try {
                            fileObj = this.packr.unpack(valueBuffer) as MessageStorageItem;
                        } catch (error) { throw new Error(`Cannot decode file (maybe damaged) ${field}: ` + (error instanceof Error ? error.message : '')) }
                        target.push(fileObj);

                        if (++index % REPORT_ITEMS == 0)
                            cbProgress.percent(index, Math.round(100 * index / allMessageCount), size);
                    }
                }
                cbProgress.percent(allMessageCount, 100, size);
            }
            cbReady();
        })();
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const dbData = this.packr.pack(message);
            new TextEncoder().encode()
            awaitSync(this.redis.hSet(KEYNAME, messageId, dbData.toString('binary')));
            log.debug({ messageId, size: dbData.length }, 'Store message');
        } catch (error) { throw new RedisStorageError(`Cannot create message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            awaitSync(this.redis.hDel(KEYNAME, messageId));
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new RedisStorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    getResources(type: StorageResourceType): { resourceId: string, optionjson: string }[] { type; return [] }
    addOrUpdateResource(type: StorageResourceType, resourceId: string, optionjson: string): void { type; resourceId; optionjson; }
    deleteResource(type: StorageResourceType, resourceId: string): void { type; resourceId; }

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
                this._redis.on('error', (err) => log.error(err));
            }
            catch (error) { throw new RedisStorageError(`Error initial connection to redis '${connection}': ${error instanceof Error ? error.message : ''}`); }
        })();
    }
}