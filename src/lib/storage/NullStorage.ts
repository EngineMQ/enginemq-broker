import { IStorage, MessageStorageItem } from "./IStorage";
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

    public close(): void { }
}