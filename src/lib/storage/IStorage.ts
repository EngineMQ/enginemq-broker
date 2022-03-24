import * as messages from "../../common/messageTypes";

type MessageInfo = {
    sourceClientId: string,
    publishTime: number,
}
export type MessageStorageItem = messages.ClientMessagePublish & MessageInfo;
export type ResourceType = 'validator' | 'route';

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

    getResources(type: ResourceType): Map<string, string>;
    addOrUpdateResource(type: ResourceType, name: string, options: string): void;
    deleteResource(type: ResourceType, name: string): void;

    close(): void;
}
