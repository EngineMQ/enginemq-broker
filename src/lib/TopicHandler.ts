import * as timsort from 'timsort';

import logger from './logger';
import * as utility from './utility';
import { MessageStorageItem } from './storage/IStorage';

const SORT_AFTER_NEWITEMS = 4879;
const SORT_AFTER_TIME_MS = 1049;

type MessageId = string;
type Topic = string;

const nowMs = () => new Date().getTime();
const log = logger.child({ module: 'Topic' });

export class TopicHandler {
    private topics = new Map<Topic, MessageStorageItem[]>();
    private topicSortInfo = new Map<Topic, { newItems: number, lastSortAt: number }>();



    // Public

    public addMessage(topic: Topic, item: MessageStorageItem, bulkMode = false) {
        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.topicSortInfo.set(topic, { newItems: 0, lastSortAt: nowMs() });
            log.info({ topic }, 'Topic created');
        }
        const msglist = this.topics.get(topic);
        if (msglist) {
            msglist.push(item);
            if (!bulkMode) {
                this.updateSortInfoIncNewItems(topic);
                this.sortTopicLazy(topic);
            }
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

    public reSortAllTopics() {
        for (const topic of this.topics.keys())
            this.sortTopic(topic);
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
        const result: { topic: string, count: number, minAge: number, maxAge: number, avgAge: number }[] = [];
        for (const [topic, msglist] of this.topics.entries())
            if (msglist.length > 0) {
                const now = nowMs();
                let minAge = Number.MAX_SAFE_INTEGER;
                let maxAge = Number.MIN_SAFE_INTEGER;
                let sumAge = 0;
                for (const msg of msglist) {
                    if (minAge > now - msg.publishTime)
                        minAge = now - msg.publishTime;
                    if (maxAge < now - msg.publishTime)
                        maxAge = now - msg.publishTime;
                    sumAge += now - msg.publishTime;
                }
                result.push({ topic, count: msglist.length, minAge, maxAge, avgAge: Math.round(sumAge / msglist.length) })
            }
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
    private updateSortInfoIncNewItems(topic: Topic, count = 1) {
        const sortInfo = this.topicSortInfo.get(topic);
        if (sortInfo)
            sortInfo.newItems += count;
    }

    private sortTopicLazy(topic: Topic) {
        let needsort = false;

        const sortInfo = this.topicSortInfo.get(topic);
        if (sortInfo) {
            if (nowMs() > sortInfo.lastSortAt + SORT_AFTER_TIME_MS)
                needsort = true;
            if (sortInfo.newItems >= SORT_AFTER_NEWITEMS)
                needsort = true;
        }
        if (needsort)
            this.sortTopic(topic);
    }

    private sortTopic(topic: Topic) {
        const msglist = this.topics.get(topic);
        if (msglist) {
            const measureTime = new utility.MeasureTime();
            timsort.sort(msglist, this.messageStorageItemSorter);

            const sortInfo = this.topicSortInfo.get(topic);
            if (sortInfo) {
                sortInfo.lastSortAt = nowMs();
                sortInfo.newItems = 0;
            }

            measureTime.measure('sort');
            measureTime.writeLog((valuestr: string[]) => log.debug({ topic, times: valuestr }, 'Sort topic'));
        }
        else
            logger.warn({ topic }, 'Topic not found for sort');
    }

    private messageStorageItemSorter = (a: MessageStorageItem, b: MessageStorageItem) => {
        let result = a.options.priority - b.options.priority;
        if (!result)
            result = a.publishTime - b.publishTime;
        return result;
    };
}