import * as messages from '../../common/messageTypes';
import { ResourceType } from '../ResourceHandler';

type MessageInfo = {
    sourceClientId: string,
    publishTime: number,
}
export { ResourceType } from '../ResourceHandler';

export type MessageStorageItem = messages.ClientMessagePublish & MessageInfo;
export type ResourceStorageItem = { resourceId: string, optionjson: string };

export interface IStorage {
    getAllMessages(
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
    ): MessageStorageItem[];
    addOrUpdateMessage(messageId: string, message: MessageStorageItem): void;
    deleteMessage(messageId: string): void;

    getResources(type: ResourceType): ResourceStorageItem[];
    addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void;
    deleteResource(type: ResourceType, resourceId: string): void;

    close(): void;
}
