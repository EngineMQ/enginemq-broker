import * as fs from 'fs';
import * as path from 'path';
import { Packr } from 'msgpackr';

import { IStorage, MessageStorageItem } from "./IStorage";
import logger from '../logger';

class LocalStorageError extends Error { }

const log = logger.child({ module: 'LocalStorage' });

const subfolderDepth = 2;
const subfolderLength = 1;
export class LocalStorage implements IStorage {
    private packr = new Packr();
    private folder;

    constructor(folder: string) {
        this.folder = folder;
        log.info({ folder }, 'Init folder');
        this.init(folder);
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
            const allFiles = this.getAllFilesRecursively(this.folder);
            log.debug({ count: allFiles.length }, 'Find messages');
            cbProgress.total(allFiles.length);

            if (allFiles.length) {
                let index = 0;
                let size = 0;
                for (const file of allFiles) {
                    let fileData: Buffer;
                    try {
                        fileData = fs.readFileSync(file);
                        size += fileData.length;
                    } catch (error) { throw new Error(`Cannot read file ${file}`) }

                    let fileObj: MessageStorageItem;
                    try {
                        fileObj = this.packr.unpack(fileData) as MessageStorageItem;
                    } catch (error) { throw new Error(`Cannot decode file (maybe damaged) ${file}` + (error instanceof Error ? error.message : '')) }
                    target.push(fileObj);

                    if (++index % REPORT_ITEMS == 0)
                        cbProgress.percent(index, Math.round(100 * index / allFiles.length), size);
                }
                cbProgress.percent(allFiles.length, 100, size);
            }
        } catch (error) { throw new LocalStorageError(`Cannot read messages: ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const fileData = this.packr.pack(message);
            fs.writeFileSync(
                this.getFileNameForId(messageId, true),
                fileData);
            log.debug({ messageId, size: fileData.length }, 'Store message');

        } catch (error) { throw new LocalStorageError(`Cannot store message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            const filename = this.getFileNameForId(messageId, false);
            if (fs.existsSync(filename))
                fs.unlinkSync(filename);
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new LocalStorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public close(): void { }


    // Private

    private init(folder: string) {
        try {
            fs.mkdirSync(folder, { recursive: true });
        }
        catch (error) { throw new LocalStorageError(`Cannot create folder '${folder}': ${error instanceof Error ? error.message : ''}`); }
    }

    private getFileNameForId(messageId: string, createFolder: boolean) {
        return path.join(
            this.getFolderForId(messageId, createFolder),
            messageId
        );
    }

    private getFolderForId(messageId: string, createFolder: boolean) {
        let subfolder = '';
        if (messageId.length >= subfolderDepth * subfolderLength) {
            const paths = [];
            for (let i = 0; i < subfolderDepth; i++)
                paths.push(messageId.substring(i * subfolderLength, (i + 1) * subfolderLength));
            subfolder = path.join(...paths);
        }
        const result = path.join(this.folder, subfolder);

        if (createFolder)
            try { fs.mkdirSync(result, { recursive: true }); }
            catch (error) { throw new LocalStorageError(`Cannot create folder '${result}': ${error instanceof Error ? error.message : ''}`); }

        return result;
    }

    private getAllFilesRecursively(dir: string, filelist: string[] = []): string[] {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory())
                filelist = this.getAllFilesRecursively(filePath, filelist);
            else
                filelist.push(filePath);
        }
        return filelist;
    }
}