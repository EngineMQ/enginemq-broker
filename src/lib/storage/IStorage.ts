import * as messages from "../../common/messageTypes";

type MessageInfo = {
    sourceClientId: string,
    publishTime: number,
}
export type MessageStorageItem = messages.ClientMessagePublish & MessageInfo;

export interface IStorage {
    getMessages(
        target: MessageStorageItem[],
        cbProgress: {
            total: (count: number) => void
            percent: (count: number, percent: number, size: number) => void
        }
    ): void;
    addOrUpdateMessage(messageId: string, message: MessageStorageItem): void;
    deleteMessage(messageId: string): void;
}
