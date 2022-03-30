import * as messages from '../../common/messageTypes';

type MessageInfo = {
    sourceClientId: string,
    publishTime: number,
}
export type MessageStorageItem = messages.ClientMessagePublish & MessageInfo;

export type StorageResourceType = 'validator' | 'router';

export interface IStorage {
    getAllMessages(
        target: MessageStorageItem[],
        cbProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        cbReady: () => void,
    ): void;
    addOrUpdateMessage(messageId: string, message: MessageStorageItem): void;
    deleteMessage(messageId: string): void;

    getResources(type: StorageResourceType): { resourceId: string, optionjson: string }[];
    addOrUpdateResource(type: StorageResourceType, resourceId: string, optionjson: string): void;
    deleteResource(type: StorageResourceType, resourceId: string): void;

    close(): void;
}
