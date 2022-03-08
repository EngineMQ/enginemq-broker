import * as timsort from 'timsort';

import logger from './logger';
import * as utility from './utility';
import { MessageStorageItem } from './storage/IStorage';

type MessageId = string;
type Topic = string;

const nowMs = () => new Date().getTime();

export class TopicHandler {
    private topics = new Map<Topic, MessageStorageItem[]>();



    // Public

    public addMessage(topic: Topic, item: MessageStorageItem, bulkMode = false) {
        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            logger.info(`New topic [${topic}] created`);
        }
        const msglist = this.topics.get(topic);
        if (msglist) {
            msglist.push(item);
            if (!bulkMode)
                timsort.sort(msglist, this.messageStorageItemSorter);
        }
    }

    public getMessage(topic: Topic, messageId: MessageId): MessageStorageItem | null {
        const msglist = this.topics.get(topic);
        if (msglist) {
            const existingIndex = msglist.findIndex((item: MessageStorageItem) => item.options.messageId === messageId);
            if (existingIndex >= 0)
                return msglist[existingIndex] || null;
        }
        return null;
    }

    public reSortTopics() {
        for (const msglist of this.topics.values())
            timsort.sort(msglist, this.messageStorageItemSorter);
    }

    public dropMessage(topic: Topic, messageId: MessageId) {
        const msglist = this.topics.get(topic);
        if (msglist) {
            const existingIndex = msglist.findIndex((item: MessageStorageItem) => item.options.messageId === messageId);
            if (existingIndex >= 0)
                msglist.splice(existingIndex, 1);
        }
    }

    public getSomeExpiredMessages(): MessageId[] {
        const now = nowMs();

        const rndTopics = this.getActiveTopicsRandomized();
        if (rndTopics.length) {
            const msglist = this.topics.get(rndTopics[0] || '');
            if (msglist)
                return msglist
                    .filter((item: MessageStorageItem) => item.options.expirationMs && now > item.publishTime + item.options.expirationMs)
                    .map((item: MessageStorageItem) => item.options.messageId);
        }

        return [];
    }

    public getTopicsInfo() {
        const result: { topic: string, count: number }[] = [];
        for (const [topic, msglist] of this.topics.entries())
            if (msglist.length > 0)
                result.push({ topic, count: msglist.length });
        return result;
    }

    public getActiveTopicsRandomized = (): string[] => {
        const result: string[] = [];
        for (const [topic, msglist] of this.topics.entries())
            if (msglist.length > 0)
                result.push(topic);
        return utility.shuffleArray(result);
    }

    public getNextAvailableMessageIterator(topic: string) {
        const now = nowMs();

        const isItemSchedulable = (item: MessageStorageItem): boolean => {
            if (item.options.delayMs && now < item.publishTime + item.options.delayMs)
                return false;
            if (item.options.expirationMs && now > item.publishTime + item.options.expirationMs)
                return false;
            return true;
        };

        return {
            msglist: this.topics.get(topic),
            index: 0,
            next: function () {
                if (!this.msglist)
                    return { done: true };
                while (this.index < this.msglist.length && !isItemSchedulable(this.msglist[this.index] as MessageStorageItem))
                    this.index++;
                if (this.index >= this.msglist.length)
                    return { done: true };
                return {
                    value: this.msglist[this.index++] as MessageStorageItem,
                    done: false,
                };
            },
            [Symbol.iterator]: function () { return this; }
        }
    }



    // Private

    private messageStorageItemSorter = (a: MessageStorageItem, b: MessageStorageItem) => {
        let result = a.options.priority - b.options.priority;
        if (!result)
            result = a.publishTime - b.publishTime;
        return result;
    };
}