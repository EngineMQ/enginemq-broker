import * as timsort from 'timsort';
import * as prettyMilliseconds from 'pretty-ms';
import { CounterMetrics } from 'metrics-1-5-15'

import logger from './logger';
import * as utility from './utility';
import { MessageStorageItem } from './storage/IStorage';

const SORT_AFTER_NEWITEMS = 2049;
const SORT_AFTER_TIME_MS = 1049;
const SORT_LAZY_TIME_MS = 249;

type MessageId = string;
type Topic = string;

const nowMs = () => new Date().getTime();
const log = logger.child({ module: 'Topic' });

export class TopicHandler {
    private topics = new Map<Topic, MessageStorageItem[]>();
    private topicSortInfo = new Map<Topic, { newItems: number, lastSortAt: number, timerSorter: number }>();
    private topicMetric = new Map<Topic, { add: CounterMetrics, remove: CounterMetrics }>();



    // Public

    public addMessage(topic: Topic, item: MessageStorageItem, bulkMode = false) {
        if (!this.topics.has(topic)) {
            this.topics.set(topic, []);
            this.topicSortInfo.set(topic, { newItems: 0, lastSortAt: nowMs(), timerSorter: 0 });
            this.topicMetric.set(topic, { add: new CounterMetrics(), remove: new CounterMetrics() });
            log.info({ topic }, 'Topic created');
        }
        const msglist = this.topics.get(topic);
        if (msglist) {
            msglist.push(item);
            if (!bulkMode) {
                this.updateSortInfoIncNewItems(topic);
                this.sortTopicLazy(topic);
                this.tickMetric(topic, true);
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
            this.sortTopic(topic, 'resortall');
    }

    public removeMessage(topic: Topic, messageId: MessageId) {
        const msglist = this.topics.get(topic);
        if (msglist) {
            const existingIndex = msglist.findIndex((item: MessageStorageItem) => item.options.messageId === messageId);
            if (existingIndex >= 0) {
                msglist.splice(existingIndex, 1);
                this.tickMetric(topic, false);
            }
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
        const result: {
            topicName: string,
            count: number,
            age: { min: number, max: number, avg: number },
            ageHuman: { min: string, max: string, avg: string },
        }[] = [];
        for (const [topic, msglist] of this.topics.entries()) {
            const now = nowMs();
            let minAge = Number.MAX_SAFE_INTEGER;
            let maxAge = Number.MIN_SAFE_INTEGER;
            let sumAge = 0;
            if (msglist.length)
                for (const msg of msglist) {
                    if (minAge > now - msg.publishTime)
                        minAge = now - msg.publishTime;
                    if (maxAge < now - msg.publishTime)
                        maxAge = now - msg.publishTime;
                    sumAge += now - msg.publishTime;
                }
            else
                maxAge = minAge = 0;
            result.push({
                topicName: topic,
                count: msglist.length,
                age: {
                    min: minAge,
                    max: maxAge,
                    avg: msglist.length ? Math.round(sumAge / msglist.length) : 0,
                },
                ageHuman:
                {
                    min: prettyMilliseconds(minAge, { compact: true }),
                    max: prettyMilliseconds(maxAge, { compact: true }),
                    avg: prettyMilliseconds(Math.round(msglist.length ? Math.round(sumAge / msglist.length) : 0), { compact: true }),
                },
            })
        }
        result.sort((a, b) => a.topicName.localeCompare(b.topicName));
        return result;
    }
    public getAllTopics() {
        return Array.from(this.topics.keys()).sort();
    }

    public getActiveTopicsRandomized(): string[] {
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

    public getMetricByMinutes(topic: Topic) {
        const metrics = this.topicMetric.get(topic);
        if (metrics)
            return {
                add: metrics.add.getCountByMinutes(),
                remove: metrics.remove.getCountByMinutes(),
            }
        return null;
    }



    // Private
    private updateSortInfoIncNewItems(topic: Topic, count = 1) {
        const sortInfo = this.topicSortInfo.get(topic);
        if (sortInfo)
            sortInfo.newItems += count;
    }

    private sortTopicLazy(topic: Topic) {
        let needsortReason = '';

        const sortInfo = this.topicSortInfo.get(topic);
        if (sortInfo) {
            if (nowMs() > sortInfo.lastSortAt + SORT_AFTER_TIME_MS)
                needsortReason = 'time';
            if (sortInfo.newItems >= SORT_AFTER_NEWITEMS)
                needsortReason = 'count';
            if (sortInfo.timerSorter)
                clearTimeout(sortInfo.timerSorter);
        }
        if (needsortReason)
            this.sortTopic(topic, needsortReason);
        else if (sortInfo) {
            const timer = setTimeout(
                (topicToSort: Topic) => this.sortTopic(topicToSort, 'lazy'),
                SORT_LAZY_TIME_MS,
                topic);
            sortInfo.timerSorter = timer as unknown as number;
        }
    }

    private sortTopic(topic: Topic, reason: string) {
        const msglist = this.topics.get(topic);
        if (msglist) {
            const measureTime = new utility.MeasureTime();
            timsort.sort(msglist, this.messageStorageItemSorter);

            const sortInfo = this.topicSortInfo.get(topic);
            if (sortInfo) {
                sortInfo.lastSortAt = nowMs();
                sortInfo.newItems = 0;
                if (sortInfo.timerSorter) {
                    clearTimeout(sortInfo.timerSorter);
                    sortInfo.timerSorter = 0;
                }
            }

            measureTime.measure('sort');
            measureTime.writeLog((valuestr: string[]) => log.debug({ topic, reason, metric: valuestr }, 'Sort topic'));
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

    private tickMetric(topic: Topic, isAdd: boolean) {
        const metrics = this.topicMetric.get(topic);
        if (metrics) {
            const metric = isAdd ? metrics.add : metrics.remove;
            metric.incCounter();
        }
    }
}