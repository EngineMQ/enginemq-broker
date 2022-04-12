import * as path from 'node:path';

import { IStorage } from './IStorage';
import { FileStorage } from './FileStorage';
import { Sqlite3Storage } from './Sqlite3Storage';
import { NullStorage } from './NullStorage';

let storageMaskFile = '^ fs \\( folder = ([a-z0-9.\\-_/\\\\]*) \\) $';
while (storageMaskFile.includes(' '))
    storageMaskFile = storageMaskFile.replace(' ', '\\s*');

let storageMaskSqlite3 = '^ sqlite3 \\( file = ([a-z0-9.\\-_/\\\\]*) \\) $';
while (storageMaskSqlite3.includes(' '))
    storageMaskSqlite3 = storageMaskSqlite3.replace(' ', '\\s*');

let storageMaskNull = '^ null \\( \\) $';
while (storageMaskNull.includes(' '))
    storageMaskNull = storageMaskNull.replace(' ', '\\s*');

export default (config: string): IStorage => {
    const storageFile = config.match(new RegExp(storageMaskFile, 'i'));
    if (storageFile) {
        const folder = storageFile[1] as string;
        return new FileStorage(folder);
    }

    const storageSqlite3 = config.match(new RegExp(storageMaskSqlite3, 'i'));
    if (storageSqlite3) {
        let file = storageSqlite3[1] as string;
        if (!path.extname(file))
            file += '.sqlite3';
        return new Sqlite3Storage(file);
    }

    const storageNull = config.match(new RegExp(storageMaskNull, 'i'));
    if (storageNull) {
        return new NullStorage();
    }

    throw new Error(`Cannot apply storage config '${config}'`);
}
