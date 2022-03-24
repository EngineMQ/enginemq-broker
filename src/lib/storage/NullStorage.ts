import { IStorage, MessageStorageItem, ResourceType } from "./IStorage";
import logger from '../logger';

const log = logger.child({ module: 'NullStorage' });

export class NullStorage implements IStorage {
    public getAllMessages(
        target: MessageStorageItem[],
        cbProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        cbReady: () => void,
    ) {
        log.warn('NullStorage in use, not data will be saved');
        target;
        cbProgress.total(0);
        cbReady();
    }

    public addOrUpdateMessage(messageId: string): void {
        log.debug({ messageId, size: 0 }, 'Store message (no)');
    }

    public deleteMessage(messageId: string): void {
        log.debug({ messageId }, 'Delete message (no)');
    }

    getResources(type: ResourceType): Map<string, string> {
        type;
        return new Map<string, string>();
    }

    addOrUpdateResource(type: ResourceType, name: string, options: string): void {
        log.debug({ type, name, size: options.length }, 'Store resource (no)');
    }

    deleteResource(type: ResourceType, name: string): void {
        log.debug({ type, name }, 'Delete resource (no)');
    }

    public close(): void { }
}