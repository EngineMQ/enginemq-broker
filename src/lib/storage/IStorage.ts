import * as messages from '../../common/messageTypes';
import { ResourceType } from '../ResourceHandler';

type MessageInfo = {
    sourceClientId: string,
    publishTime: number,
}
export { ResourceType } from '../ResourceHandler';

export type MessageStorageItem = messages.ClientMessagePublish & MessageInfo;

export type ResourceListItem = { resourceId: string, optionjson: string };
export type ResourceList = ResourceListItem[];

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

    getResources(type: ResourceType): Promise<ResourceList>;
    addOrUpdateResource(type: ResourceType, resourceId: string, optionjson: string): void;
    deleteResource(type: ResourceType, resourceId: string): void;

    close(): void;
}
