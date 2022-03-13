import * as fs from 'fs';
import * as path from 'path';
import { Packr } from 'msgpackr';
import * as Sqlite3 from 'better-sqlite3';


import { IStorage, MessageStorageItem } from "./IStorage";
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
        cbProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        }
    ) {
        const REPORT_ITEMS = 10000;
        try {
            const allMessageCount = this.db.prepare('SELECT COUNT(*) FROM message').pluck().get() as number;
            log.debug({ count: allMessageCount }, 'Find messages');
            cbProgress.total(allMessageCount);

            if (allMessageCount) {
                let index = 0;
                let size = 0;
                for (const _row of this.db.prepare('SELECT Data FROM message').iterate()) {
                    const row = _row as { MessageId: string, Data: Buffer };
                    if (Buffer.isBuffer(row.Data)) {
                        size += row.Data.length;

                        let fileObj: MessageStorageItem;
                        try {
                            fileObj = this.packr.unpack(row.Data) as MessageStorageItem;
                        } catch (error) { throw new Error(`Cannot decode file (maybe damaged) ${row.MessageId}` + (error instanceof Error ? error.message : '')) }
                        target.push(fileObj);

                        if (++index % REPORT_ITEMS == 0)
                            cbProgress.percent(index, Math.round(100 * index / allMessageCount), size);
                    }
                }
                cbProgress.percent(allMessageCount, 100, size);
            }
        } catch (error) { throw new Sqlite3StorageError(`Cannot load messages: ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const dbData = this.packr.pack(message);
            this.prepares.insert.run({ id: messageId, data: dbData });
            log.debug({ messageId, size: dbData.length }, 'Store message');
        } catch (error) { throw new Sqlite3StorageError(`Cannot create message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            this.prepares.delete.run({ id: messageId });
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new Sqlite3StorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
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
            const db = new Sqlite3(file, {
                verbose: (line: string) => log.trace({ cmd: line }, 'SQLite3 command'),
            });
            for (const pragma of initPragmas)
                db.pragma(pragma);
            for (const command of initCommands)
                db.exec(command);
            return db;
        }
        catch (error) { throw new Sqlite3StorageError(`Error initializing sqlite3 database '${file}': ${error instanceof Error ? error.message : ''}`); }
    }

    private initPrepares(db: Sqlite3.Database) {
        return {
            insert: db.prepare('INSERT OR REPLACE INTO message (MessageId, Data) VALUES (@id, @data)'),
            delete: db.prepare('DELETE FROM message WHERE MessageId = @id'),
        }
    }
}