import * as path from 'path';

import { IStorage } from "./IStorage";
import { LocalStorage } from "./LocalStorage";
import { Sqlite3Storage } from "./Sqlite3Storage";

let storageMaskLocal = "^ fs \\( folder = ([a-z0-9.\\-_/\\\\]*) \\) $";
while (storageMaskLocal.includes(' '))
    storageMaskLocal = storageMaskLocal.replace(' ', '\\s*');

let storageMaskSqlite3 = "^ sqlite3 \\( file = ([a-z0-9.\\-_/\\\\]*) \\) $";
while (storageMaskSqlite3.includes(' '))
    storageMaskSqlite3 = storageMaskSqlite3.replace(' ', '\\s*');

export default (config: string): IStorage => {
    const storageLocal = config.match(new RegExp(storageMaskLocal, "i"));
    if (storageLocal) {
        const folder = storageLocal[1] as string;
        return new LocalStorage(folder);
    }

    const storageSqlite3 = config.match(new RegExp(storageMaskSqlite3, "i"));
    if (storageSqlite3) {
        let file = storageSqlite3[1] as string;
        if (!path.extname(file))
            file += '.sqlite3';
        return new Sqlite3Storage(file);
    }

    throw new Error(`Cannot apply storage config '${config}'`);
}
