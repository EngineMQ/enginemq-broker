import * as fs from 'node:fs';
import * as path from 'node:path';
import { Packr } from 'msgpackr';
import * as Sqlite3 from 'better-sqlite3';

import { IStorage, MessageStorageItem, StorageResourceType } from './IStorage';
import logger from '../logger';

class Sqlite3StorageError extends Error { }

type Statement = Sqlite3.Statement<any[]>;

const log = logger.child({ module: 'Sqlite3Storage' });
const initPragmas = ['journal_mode = WAL'];
const initCommands = [
    'CREATE TABLE IF NOT EXISTS message (MessageId VARCHAR(32) PRIMARY KEY, Data BLOB)',
];

export class Sqlite3Storage implements IStorage {
    private db: Sqlite3.Database;
    private prepares: {
        insert: Statement,
        delete: Statement,
    };
    private packr = new Packr();

    constructor(file: string) {
        log.info({ file }, 'Init Sqlite3 database');
        this.db = this.init(file);
        this.prepares = this.initPrepares(this.db);
    }



    // Public

    public getAllMessages(
        target: MessageStorageItem[],
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        callbackReady: () => void,
    ) {
        const REPORT_ITEMS = 10_000;
        try {
            const allMessageCount = this.db.prepare('SELECT COUNT(*) FROM message').pluck().get() as number;
            log.debug({ count: allMessageCount }, 'Find messages');
            callbackProgress.total(allMessageCount);

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
                        target.push(fileObject);

                        if (++index % REPORT_ITEMS == 0)
                            callbackProgress.percent(index, Math.round(100 * index / allMessageCount), size);
                    }
                }
                callbackProgress.percent(allMessageCount, 100, size);
            }
            callbackReady();
        } catch (error) { throw new Sqlite3StorageError(`Cannot load messages: ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const databaseData = this.packr.pack(message);
            this.prepares.insert.run({ id: messageId, data: databaseData });
            log.debug({ messageId, size: databaseData.length }, 'Store message');
        } catch (error) { throw new Sqlite3StorageError(`Cannot create message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            this.prepares.delete.run({ id: messageId });
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new Sqlite3StorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    getResources(type: StorageResourceType): { resourceId: string, optionjson: string }[] { type; return [] }
    addOrUpdateResource(type: StorageResourceType, resourceId: string, optionjson: string): void { type; resourceId; optionjson; }
    deleteResource(type: StorageResourceType, resourceId: string): void { type; resourceId; }

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

    private initPrepares(database: Sqlite3.Database) {
        return {
            insert: database.prepare('INSERT OR REPLACE INTO message (MessageId, Data) VALUES (@id, @data)'),
            delete: database.prepare('DELETE FROM message WHERE MessageId = @id'),
        }
    }
}