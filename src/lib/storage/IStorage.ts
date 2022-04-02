import * as messages from '../../common/messageTypes';
import { ResourceType } from '../ResourceHandler';

type MessageInfo = {
    sourceClientId: string,
    publishTime: number,
}
export type MessageStorageItem = messages.ClientMessagePublish & MessageInfo;

export { ResourceType } from '../ResourceHandler';

export interface IStorage {
    getAllMessages(
        target: MessageStorageItem[],
        callbackProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        },
        callbackReady: () => void,
    ): void;
    addOrUpdateMessage(messageId: string, message: MessageStorageItem): void;
    deleteMessage(messageId: string): void;

    getResources(type: ResourceType): { resourceId: string, optionjson: string }[];
    addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void;
    deleteResource(type: ResourceType, resourceId: string): void;

    close(): void;
}
