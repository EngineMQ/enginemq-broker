import * as fs from 'node:fs';
import * as path from 'node:path';
import { Packr } from 'msgpackr';
import * as Sqlite3 from 'better-sqlite3';

import { IStorage, MessageStorageItem, ResourceStorageItem, ResourceType } from './IStorage';
import logger from '../logger';

class Sqlite3StorageError extends Error { }

type Statement = Sqlite3.Statement<any[]>;
type Sqlite3Prepares = {
    insertMessage: Statement,
    deleteMessage: Statement,
    insertResource: Statement,
    deleteResource: Statement,
};

const log = logger.child({ module: 'Sqlite3Storage' });

const initPragmas = ['journal_mode = WAL'];
const initCommands = [
    'CREATE TABLE IF NOT EXISTS message (MessageId VARCHAR(32) PRIMARY KEY, Data BLOB)',
    'CREATE TABLE IF NOT EXISTS resource (ResourceType VARCHAR(32), ResourceId VARCHAR(20), Option VARCHAR, PRIMARY KEY (ResourceType, ResourceId))',
];
const initPrepares = (database: Sqlite3.Database): Sqlite3Prepares => {
    return {
        insertMessage: database.prepare('INSERT OR REPLACE INTO message (MessageId, Data) VALUES (@id, @data)'),
        deleteMessage: database.prepare('DELETE FROM message WHERE MessageId = @id'),
        insertResource: database.prepare('INSERT OR REPLACE INTO resource (ResourceType, ResourceId, Option) VALUES (@type, @id, @option)'),
        deleteResource: database.prepare('DELETE FROM resource WHERE ResourceType = @type AND ResourceId = @id'),
    }
}

export class Sqlite3Storage implements IStorage {
    private db: Sqlite3.Database;
    private prepares: Sqlite3Prepares;
    private packr = new Packr();

    constructor(file: string) {
        log.info({ file }, 'Init Sqlite3 database');
        this.db = this.init(file);
        this.prepares = initPrepares(this.db);
    }



    // Public

    public getAllMessages(
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
    ): MessageStorageItem[] {
        const REPORT_ITEMS = 10_000;
        try {
            const allMessageCount = this.db.prepare('SELECT COUNT(*) FROM message').pluck().get() as number;
            log.debug({ count: allMessageCount }, 'Find messages');
            callbackProgress.total(allMessageCount);

            const result = [];
            if (allMessageCount) {
                let index = 0;
                let size = 0;
                for (const _row of this.db.prepare('SELECT Data FROM message').iterate()) {
                    const row = _row as { MessageId: string, Data: Buffer };
                    if (Buffer.isBuffer(row.Data)) {
                        size += row.Data.length;

                        let fileObject: MessageStorageItem;
                        try {
                            fileObject = this.packr.unpack(row.Data) as MessageStorageItem;
                        } catch (error) { throw new Error(`Cannot decode file (maybe damaged) ${row.MessageId}: ` + (error instanceof Error ? error.message : '')) }
                        result.push(fileObject);

                        if (++index % REPORT_ITEMS == 0)
                            callbackProgress.percent(index, Math.round(100 * index / allMessageCount), size);
                    }
                }
                callbackProgress.percent(allMessageCount, 100, size);
            }
            return result;
        } catch (error) { throw new Sqlite3StorageError(`Cannot load messages: ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const databaseData = this.packr.pack(message);
            this.prepares.insertMessage.run({ id: messageId, data: databaseData });
            log.debug({ messageId, size: databaseData.length }, 'Store message');
        } catch (error) { throw new Sqlite3StorageError(`Cannot create message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            this.prepares.deleteMessage.run({ id: messageId });
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new Sqlite3StorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public getResources(type: ResourceType): ResourceStorageItem[] {
        try {
            const resources = [];
            for (const _row of this.db.prepare('SELECT ResourceType, ResourceId, Option FROM resource').iterate()) {
                const row = _row as { ResourceType: string, ResourceId: string, Option: Buffer };
                if (row.ResourceType == type)
                    resources.push({ resourceId: row.ResourceId, optionjson: row.Option.toString() });
            }
            return resources;
        } catch (error) { throw new Sqlite3StorageError(`Cannot load resources '${type}': ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void {
        try {
            this.prepares.insertResource.run({ type: type, id: resourceId, option: optionjson });
            log.debug({ type, resourceId }, 'Store resource');
        } catch (error) { throw new Sqlite3StorageError(`Cannot store ${type} resource '${resourceId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteResource(type: ResourceType, resourceId: string): void {
        try {
            this.prepares.deleteResource.run({ type: type, id: resourceId });
            log.debug({ type, resourceId }, 'Delete resource');
        } catch (error) { throw new Sqlite3StorageError(`Cannot delete ${type} resource '${resourceId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public close(): void {
        this.db.close();
    }



    // Private

    private init(file: string): Sqlite3.Database {
        const folder = path.dirname(file);
        try {
            fs.mkdirSync(folder, { recursive: true });
        }
        catch (error) { throw new Sqlite3StorageError(`Cannot create folder '${folder}': ${error instanceof Error ? error.message : ''}`); }

        try {
            const database = new Sqlite3(file, {
                verbose: (line: string) => log.trace({ cmd: line }, 'SQLite3 command'),
            });
            for (const pragma of initPragmas)
                database.pragma(pragma);
            for (const command of initCommands)
                database.exec(command);
            return database;
        }
        catch (error) { throw new Sqlite3StorageError(`Error initializing sqlite3 database '${file}': ${error instanceof Error ? error.message : ''}`); }
    }
}