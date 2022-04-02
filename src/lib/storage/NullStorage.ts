import { IStorage, MessageStorageItem, ResourceType } from './IStorage';
import logger from '../logger';

const log = logger.child({ module: 'NullStorage' });

export class NullStorage implements IStorage {
    public getAllMessages(
        target: MessageStorageItem[],
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        callbackReady: () => void,
    ) {
        log.warn('NullStorage in use, not data will be saved');
        target;
        callbackProgress.total(0);
        callbackReady();
    }

    public addOrUpdateMessage(messageId: string): void {
        log.debug({ messageId, size: 0 }, 'Store message (no)');
    }

    public deleteMessage(messageId: string): void {
        log.debug({ messageId }, 'Delete message (no)');
    }

    getResources(type: ResourceType): { resourceId: string, optionjson: string }[] {
        type;
        return [];
    }

    addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void {
        log.debug({ type, resourceId, size: optionjson.length }, 'Store resource (no)');
    }

    deleteResource(type: ResourceType, resourceId: string): void {
        log.debug({ type, resourceId }, 'Delete resource (no)');
    }

    public close(): void { }
}