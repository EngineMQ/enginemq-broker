import * as fs from 'fs';
import * as path from 'path';
import { Packr } from 'msgpackr';

import { IStorage, MessageStorageItem, StorageResourceType } from "./IStorage";
import logger from '../logger';

class FileStorageError extends Error { }

const log = logger.child({ module: 'FileStorage' });

const subfolderMessage = 'message';
const subfolderResource = 'resource';
const subfolderDepth = 2;
const subfolderLength = 1;
export class FileStorage implements IStorage {
    private packr = new Packr();
    private folderRoot;
    private get folderMessage() { return path.join(this.folderRoot, subfolderMessage) }
    private folderResource(type?: StorageResourceType): string {
        const resPath = path.join(this.folderRoot, subfolderResource);
        if (type)
            return path.join(resPath, type)
        return resPath;
    }

    constructor(folderRoot: string) {
        this.folderRoot = folderRoot;
        log.info({ folder: folderRoot }, 'Init folder');
        this.init();
    }



    // Public

    public getAllMessages(
        target: MessageStorageItem[],
        cbProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        cbReady: () => void,
    ) {
        const REPORT_ITEMS = 10000;
        try {
            const allFiles = this.getAllFilesRecursively(this.folderMessage);
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
                    } catch (error) { throw new Error(`Cannot decode file (maybe damaged) ${file}: ` + (error instanceof Error ? error.message : '')) }
                    target.push(fileObj);

                    if (++index % REPORT_ITEMS == 0)
                        cbProgress.percent(index, Math.round(100 * index / allFiles.length), size);
                }
                cbProgress.percent(allFiles.length, 100, size);
            }
            cbReady();
        } catch (error) { throw new FileStorageError(`Cannot read messages: ${error instanceof Error ? error.message : ''}`); }
    }

    public addOrUpdateMessage(messageId: string, message: MessageStorageItem): void {
        try {
            const fileData = this.packr.pack(message);
            fs.writeFileSync(
                this.getFileNameForMessageId(messageId, true),
                fileData);
            log.debug({ messageId, size: fileData.length }, 'Store message');

        } catch (error) { throw new FileStorageError(`Cannot store message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteMessage(messageId: string): void {
        try {
            const filename = this.getFileNameForMessageId(messageId, false);
            if (fs.existsSync(filename))
                fs.unlinkSync(filename);
            log.debug({ messageId }, 'Delete message');
        } catch (error) { throw new FileStorageError(`Cannot delete message '${messageId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public getResources(type: StorageResourceType): { resourceId: string, optionjson: string }[] {
        const result = [];

        const allFiles = this.getAllFilesRecursively(this.folderResource(type));
        for (const file of allFiles) {
            let fileData: Buffer;
            try {
                fileData = fs.readFileSync(file);
            } catch (error) { throw new Error(`Cannot read file ${file}`) }
            result.push({
                resourceId: path.basename(file),
                optionjson: fileData.toString()
            });
        }

        return result;
    }

    public addOrUpdateResource(type: StorageResourceType, resourceId: string, optionjson: string): void {
        try {
            const fileData = optionjson;
            fs.writeFileSync(
                this.getFileNameForResource(type, resourceId, true),
                fileData);
            log.debug({ name: resourceId, size: fileData.length }, 'Store resource');

        } catch (error) { throw new FileStorageError(`Cannot store ${type} resource '${resourceId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public deleteResource(type: StorageResourceType, resourceId: string): void {
        try {
            const filename = this.getFileNameForResource(type, resourceId, false);
            if (fs.existsSync(filename))
                fs.unlinkSync(filename);
            log.debug({ name: resourceId }, `Delete ${type} resource`);
        } catch (error) { throw new FileStorageError(`Cannot delete ${type} resource '${resourceId}': ${error instanceof Error ? error.message : ''}`); }
    }

    public close(): void { }


    // Private

    private init() {
        try {
            fs.mkdirSync(this.folderRoot, { recursive: true });
            fs.mkdirSync(this.folderMessage, { recursive: true });
            fs.mkdirSync(this.folderResource(), { recursive: true });
        }
        catch (error) { throw new FileStorageError(`Cannot create folders in '${this.folderRoot}': ${error instanceof Error ? error.message : ''}`); }
    }

    private getFileNameForMessageId(messageId: string, createFolder: boolean) {
        return path.join(
            this.getFolderForMessageId(messageId, createFolder),
            messageId
        );
    }

    private getFolderForMessageId(messageId: string, createFolder: boolean) {
        let subfolder = '';
        if (messageId.length >= subfolderDepth * subfolderLength) {
            const paths = [];
            for (let i = 0; i < subfolderDepth; i++)
                paths.push(messageId.substring(i * subfolderLength, (i + 1) * subfolderLength));
            subfolder = path.join(...paths);
        }
        const result = path.join(this.folderMessage, subfolder);

        if (createFolder)
            try { fs.mkdirSync(result, { recursive: true }); }
            catch (error) { throw new FileStorageError(`Cannot create folder '${result}': ${error instanceof Error ? error.message : ''}`); }

        return result;
    }

    private getFileNameForResource(type: StorageResourceType, name: string, createFolder: boolean) {
        return path.join(
            this.getFolderForResource(type, createFolder),
            name
        );
    }

    private getFolderForResource(type: StorageResourceType, createFolder: boolean) {
        const result = this.folderResource(type);

        if (createFolder)
            try { fs.mkdirSync(result, { recursive: true }); }
            catch (error) { throw new FileStorageError(`Cannot create folder '${result}': ${error instanceof Error ? error.message : ''}`); }

        return result;
    }

    private getAllFilesRecursively(folder: string, filelist: string[] = []): string[] {
        if (fs.existsSync(folder)) {
            const files = fs.readdirSync(folder);
            for (const file of files) {
                const filePath = path.join(folder, file);
                if (fs.statSync(filePath).isDirectory())
                    filelist = this.getAllFilesRecursively(filePath, filelist);
                else
                    filelist.push(filePath);
            }
        }
        return filelist;
    }
}