import { customAlphabet } from 'nanoid';

import logger from './logger';
import { ClientList } from './ClientList';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { TopicHandler } from './TopicHandler';
import * as types from '../common/messageTypes';
import * as utility from './utility';
import { AckFn, BrokerSocket } from './BrokerSocket';

const log = logger.child({ module: 'Messages' });

type MessageId = string;
type Topic = string;

const GARBAGE_SEC = 60;
const GARBAGE_BOOST_SEC = 15;
const GARBAGE_LIMIT = 1000;
const MESSAGELOOP_BOOST_ITERATIONS = 100;

const nanoid = customAlphabet(types.MESSAGE_ID_ALPHABET, types.MESSAGE_ID_LENGTH_DEFAULT);
const nowMs = () => new Date().getTime();
const messageIdRegExp = new RegExp(types.MESSAGE_ID_MASK);

export class MessageHandler {
    private clientList: ClientList;
    private storage: IStorage;
    private topics: TopicHandler;
    private topicIndexerList = new Map<MessageId, Topic>();
    private messageIndexerList = new Map<MessageId, MessageStorageItem>();
    private underDeliveryList = new Map<MessageId, BrokerSocket>();

    constructor(clientList: ClientList, storage: IStorage, topics: TopicHandler) {
        this.clientList = clientList;
        this.storage = storage;
        this.topics = topics;

        this.clientList.on('remove', (socket: BrokerSocket) => this.onReleaseClient(socket))
        setTimeout(() => this.removeSomeExpiredMessages(), GARBAGE_SEC * 1000);
    }




    // Public

    public async loadMessages(): Promise<void> {
        return new Promise((resolve, reject) => {
            const loadList: MessageStorageItem[] = [];
            log.info('Init messages');
            try {
                this.storage.getAllMessages(
                    loadList,
                    {
                        total: (count: number) => log.info(`${count ? count : 'No'} messages found`),
                        percent: (_count: number, percent: number, size: number) => log.info(`${percent}% loaded (${size > 1024 * 1024 ? `${Math.round(size / 1024 / 1024)} Mb` : `${Math.round(size / 1024)} kB`})`),
                    },
                    () => {
                        if (loadList.length) {
                            const now = nowMs();

                            let countExpired = 0;
                            let countLoaded = 0;
                            log.info('Indexing messages');
                            for (const item of loadList) {

                                const topic = item.topic;
                                const messageId = item.options.messageId;

                                if (item.options.expirationMs && now > item.publishTime + item.options.expirationMs) {
                                    this.storage.deleteMessage(messageId);
                                    countExpired++
                                    continue;
                                }

                                this.topics.addMessage(topic, item, true)

                                this.topicIndexerList.set(messageId, topic);
                                this.messageIndexerList.set(messageId, item);
                                countLoaded++;
                            }
                            if (countExpired > 0)
                                log.info({ expired: countExpired, loaded: countLoaded }, 'Delete expired messages');

                            this.topics.reSortAllTopics();
                            for (const topicInfo of this.topics
                                .getTopicsInfo()
                                .filter((topic) => topic.count))
                                log.info({
                                    topic: topicInfo.topicName,
                                    count: topicInfo.count,
                                    age:
                                    {
                                        min: topicInfo.ageHuman.min,
                                        max: topicInfo.ageHuman.max,
                                        avg: topicInfo.ageHuman.avg,
                                    }
                                }, 'Topic message stat');
                        }
                        resolve();
                    });
            }
            catch (error) { reject(error); }
        });
    }

    public addMessage(item: MessageStorageItem) {
        try {
            const topic = item.topic.toLowerCase();
            if (!item.options.messageId)
                item.options.messageId = nanoid();
            const messageId = item.options.messageId;

            if (!topic) {
                log.warn('Missing topic info');
                return;
            }
            if (!messageIdRegExp.test(messageId)) {
                log.warn({ messageid: messageId }, 'Invalid messageId format');
                return;
            }
            if (item.options.delayMs && item.options.delayMs < 0) {
                log.warn({ value: item.options.delayMs }, 'Invalid delayMs value');
                return;
            }
            if (item.options.expirationMs && item.options.expirationMs < 0) {
                log.warn({ value: item.options.expirationMs }, 'Invalid expirationMs value');
                return;
            }

            const topicOfExistingItem = this.topicIndexerList.get(messageId);
            if (topicOfExistingItem)
                this.topics.removeMessage(topicOfExistingItem, messageId);

            this.topics.addMessage(topic, item);
            this.topicIndexerList.set(messageId, topic);
            this.messageIndexerList.set(messageId, item)
            this.storage.addOrUpdateMessage(messageId, item);
        } catch (error) { log.error(error); }
    }

    private loopBroken = false;
    public startLoop() {
        this.loopBroken = false;
        setTimeout(this.messageLoop, 0);
    }
    public breakLoop() { this.loopBroken = true; }



    // Private

    private getMessage(messageId: string): MessageStorageItem | null {
        return this.messageIndexerList.get(messageId) || null;
    }

    private resendMessage(messageId: string, delayMs: number) {
        log.debug({ messageid: messageId }, 'Resend message');
        const message = this.messageIndexerList.get(messageId);
        if (message) {
            message.publishTime = nowMs();
            message.options.delayMs = delayMs;
            this.addMessage(message);
        }
        else
            log.warn({ messageid: messageId }, 'Cannot resend message');
    }

    private deleteMessage(messageId: string) {
        const topicOfExistingItem = this.topicIndexerList.get(messageId);
        log.debug({ messageid: messageId, topic: topicOfExistingItem }, 'Delete message');
        if (topicOfExistingItem) {
            this.storage.deleteMessage(messageId);

            this.underDeliveryList.delete(messageId);

            this.topics.removeMessage(topicOfExistingItem, messageId);
            this.topicIndexerList.delete(messageId);
            this.messageIndexerList.delete(messageId);
        }
        else
            log.warn({ messageid: messageId }, 'Cannot delete message, topic not found');
    }

    private removeSomeExpiredMessages() {
        log.debug('Gargabe start');

        const measureTime = new utility.MeasureTime();
        const exmsgids = this.topics
            .getSomeExpiredMessages()
            .slice(0, GARBAGE_LIMIT);
        measureTime.measure('collect');

        if (exmsgids.length) {
            const originalCount = this.messageIndexerList.size;
            for (const exmsgid of exmsgids)
                this.deleteMessage(exmsgid);
            measureTime.measure('remove');
            measureTime.writeLog((valuestr: string[]) => log.info({ expired: exmsgids.length, total: originalCount, times: valuestr }, 'Garbage expired messages'));
        }

        setTimeout(() => this.removeSomeExpiredMessages(),
            exmsgids.length == GARBAGE_LIMIT ?
                GARBAGE_BOOST_SEC * 1000 :
                GARBAGE_SEC * 1000);
    }

    private onReleaseClient(socket: BrokerSocket) {
        log.debug({ client: socket.getClientInfo().clientId, address: socket.getClientInfo().address }, 'Release client messages');
        this.underDeliveryList.forEach((value, key) => {
            if (value == socket) {
                this.underDeliveryList.delete(key);
                log.debug({ messageid: key }, 'Delivered message moved back to list');
            }
        })
    }

    private createMessageLoopDeliveryAck: AckFn = (deliveryAck: types.ClientMessageDeliveryAck) => {
        const messageId = deliveryAck.messageId;
        let ackIsCompleted = false;
        let ackResendMs = -1;

        const message = this.messageIndexerList.get(messageId);
        if (message) {
            if (message.options.qos == types.MessageQos.Feedback && message.sourceClientId) {
                const clientOrigin = this.clientList.getSocketByClientId(message.sourceClientId);
                if (clientOrigin) {
                    clientOrigin.sendDeliveryReport(deliveryAck);
                    log.debug({ client: message.sourceClientId, address: clientOrigin.getClientInfo().address, messageid: messageId }, 'Delivery report sent to client');
                }
                else
                    log.info({ client: message.sourceClientId }, 'Cannot find client for delivery report');
            }
        }
        else
            log.warn({ messageid: messageId }, 'Cannot find message for delivery report');

        if (deliveryAck.percent == 100)
            ackIsCompleted = true;

        if (deliveryAck.resolveReason) {
            this.getMessage(messageId);
            ackIsCompleted = true;
        }

        if (deliveryAck.rejectReason) {
            ackIsCompleted = true;
            if (deliveryAck.rejectRetryDelayMs !== undefined) {
                ackResendMs = deliveryAck.rejectRetryDelayMs;
                ackIsCompleted = true;
            }
        }

        if (ackIsCompleted) {
            if (ackResendMs >= 0) {
                this.underDeliveryList.delete(messageId);
                this.resendMessage(messageId, ackResendMs);
            }
            else {
                this.underDeliveryList.delete(messageId);
                this.deleteMessage(messageId);
            }
        }
        return ackIsCompleted;
    }

    private boostCount = 0;
    private messageLoop = () => {
        if (this.loopBroken) return;
        try {
            for (const topic of this.topics.getActiveTopicsRandomized()) {
                let clientTarget: BrokerSocket | null = null;
                for (const client of this.clientList.getRandomized())
                    if (client.matchSubscription(topic))
                        if (client.hasEnoughWorker()) {
                            clientTarget = client;
                            break;
                        }
                if (!clientTarget)
                    continue;

                let messageTarget: MessageStorageItem | null = null;
                for (const msg of this.topics.getNextAvailableMessageIterator(topic))
                    if (msg)
                        if (!this.underDeliveryList.has(msg.options.messageId)) {
                            messageTarget = msg;
                            break;
                        }
                if (!messageTarget)
                    continue;

                const message: types.BrokerMessageDelivery = {
                    topic: messageTarget.topic,
                    message: messageTarget.message,
                    options: messageTarget.options,
                    source: { sourceClientId: messageTarget.sourceClientId, publishTime: messageTarget.publishTime }
                }
                this.underDeliveryList.set(message.options.messageId, clientTarget);
                clientTarget.delivery(message, this.createMessageLoopDeliveryAck);
            }

            this.boostCount++;
            if (this.boostCount > MESSAGELOOP_BOOST_ITERATIONS) {
                setTimeout(this.messageLoop, 0);
                this.boostCount = 0;
            }
            else
                setImmediate(this.messageLoop);

        } catch (error) { log.error(error); }
    }
}
