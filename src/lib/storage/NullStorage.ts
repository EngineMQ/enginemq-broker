import { IStorage, MessageStorageItem, ResourceStorageItem, ResourceType } from './IStorage';
import logger from '../logger';

const log = logger.child({ module: 'NullStorage' });

export class NullStorage implements IStorage {
    public getAllMessages(
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
    ): MessageStorageItem[] {
        log.warn('NullStorage in use, not data will be saved');
        callbackProgress.total(0);
        return [];
    }

    public addOrUpdateMessage(messageId: string): void {
        log.debug({ messageId, size: 0 }, 'Store message (no)');
    }

    public deleteMessage(messageId: string): void {
        log.debug({ messageId }, 'Delete message (no)');
    }

    public getResources(type: ResourceType): ResourceStorageItem[] {
        type;
        return [];
    }

    public addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void {
        log.debug({ type, resourceId, size: optionjson.length }, 'Store resource (no)');
    }

    public deleteResource(type: ResourceType, resourceId: string): void {
        log.debug({ type, resourceId }, 'Delete resource (no)');
    }

    public close(): void { }
}