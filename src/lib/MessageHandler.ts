import * as short from 'short-uuid';

import logger from './logger';
import { ClientList } from './ClientList';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { TopicHandler } from './TopicHandler';
import * as types from '../common/messageTypes';
import * as utility from './utility';
import { AckFn, BrokerSocket } from './BrokerSocket';

const log = logger.child({ module: 'MessageHandler' });

type MessageId = string;
type Topic = string;

const GARBAGE_EXPIRED_SEC = 15;
const GARBAGE_EXPIRED_BOOST_SEC = 5;
const GARBAGE_EXPIRED_LIMIT = 1000;


const nowMs = () => new Date().getTime();

export class MessageHandler {
    private clientList: ClientList;
    private storage: IStorage;
    private topics: TopicHandler;
    private topicIndexerList = new Map<MessageId, Topic>();
    private messageIndexerList = new Map<MessageId, MessageStorageItem>();
    private underDeliveryList = new Map<MessageId, BrokerSocket>();

    constructor(clientList: ClientList, storage: IStorage) {
        this.clientList = clientList;
        this.storage = storage;
        this.topics = new TopicHandler();

        this.clientList.on('remove', (socket: BrokerSocket) => this.onReleaseClient(socket))

        this.loadMessages();

        setTimeout(() => this.removeSomeExpiredMessages(), GARBAGE_EXPIRED_SEC * 1000);
    }



    // Public

    private messageIdRegExp = new RegExp(types.MESSAGE_ID_FORMAT);
    public addMessage(item: MessageStorageItem) {
        try {
            const topic = item.topic.toLowerCase();
            if (!item.options.messageId)
                item.options.messageId = short(short.constants.flickrBase58).generate().toLocaleLowerCase();
            const messageId = item.options.messageId;

            if (!topic) {
                log.warn(`Missing topic ${topic}`);
                return;
            }
            if (!this.messageIdRegExp.test(messageId)) {
                log.warn(`Invalid messageId format ${messageId}`);
                return;
            }
            if (item.options.delayMs && item.options.delayMs < 0) {
                log.warn(`Invalid delayMs value ${item.options.delayMs}`);
                return;
            }
            if (item.options.expirationMs && item.options.expirationMs < 0) {
                log.warn(`Invalid expirationMs value ${item.options.expirationMs}`);
                return;
            }

            const topicOfExistingItem = this.topicIndexerList.get(messageId);
            if (topicOfExistingItem)
                this.topics.dropMessage(topicOfExistingItem, messageId);

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

    private loadMessages() {
        const loadList: MessageStorageItem[] = [];
        log.info({ module: 'Messages' }, 'Init messages %s', 'xxx');
        this.storage.getMessages(
            loadList,
            {
                total: (count: number) => log.info(`${count ? count : 'No'} messages found`),
                percent: (_count: number, percent: number, size: number) => log.info(`${percent}% loaded (${size > 1024 * 1024 ? `${Math.round(size / 1024 / 1024)} Mb` : `${Math.round(size / 1024)} kB`})`),
            })
        if (loadList.length) {
            log.info('Indexing messages');
            for (const item of loadList) {

                const topic = item.topic;
                const messageId = item.options.messageId;

                this.topicIndexerList.set(messageId, topic);
                this.topics.addMessage(topic, item, true)

                this.messageIndexerList.set(messageId, item);
            }
            this.topics.reSortTopics();
            for (const topicInfo of this.topics.getTopicsInfo())
                log.info(`Topic [${topicInfo.topic}] contains ${topicInfo.count} messages`);
        }
    }

    private getMessage(messageId: string): MessageStorageItem | null {
        return this.messageIndexerList.get(messageId) || null;
    }

    private resendMessage(messageId: string, delayMs: number) {
        const message = this.messageIndexerList.get(messageId);
        if (message) {
            message.publishTime = nowMs();
            message.options.delayMs = delayMs;
            this.addMessage(message);
        }
        else
            log.debug(`Cannot resend message ${messageId}`);
    }

    private deleteMessage(messageId: string) {
        const topicOfExistingItem = this.topicIndexerList.get(messageId);
        if (topicOfExistingItem) {
            this.storage.deleteMessage(messageId);

            this.underDeliveryList.delete(messageId);

            this.topics.dropMessage(topicOfExistingItem, messageId);
            this.topicIndexerList.delete(messageId);
            this.messageIndexerList.delete(messageId);

            // console.log(`Messages: ${this.indexerList.size}`);
        }
    }

    private removeSomeExpiredMessages() {
        const timeLogger = new utility.TimeLogger();
        const exmsgids = this.topics
            .getSomeExpiredMessages()
            .slice(0, GARBAGE_EXPIRED_LIMIT);
        timeLogger.measure('collect');

        if (exmsgids.length) {
            const originalCount = this.messageIndexerList.size;
            for (const exmsgid of exmsgids)
                this.deleteMessage(exmsgid);
            timeLogger.measure('remove');
            timeLogger.writeLog((valuestr: string) => log.info(`[Garbage] ${exmsgids.length} expired of ${originalCount} messages removed in ${valuestr}`));
        }

        setTimeout(() => this.removeSomeExpiredMessages(),
            exmsgids.length == GARBAGE_EXPIRED_LIMIT ?
                GARBAGE_EXPIRED_BOOST_SEC * 1000 :
                GARBAGE_EXPIRED_SEC * 1000);
    }

    private onReleaseClient(socket: BrokerSocket) {
        this.underDeliveryList.forEach((value, key) => {
            if (value == socket) {
                this.underDeliveryList.delete(key);
                log.debug(`Delivered message ${key} moved back to list`);
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
                    log.debug(`Delivery report sent to ${message.sourceClientId}@${clientOrigin.getClientInfo().addressInfo.address || ''} for ${messageId}`);
                }
                else
                    log.info(`Cannot find client ${message.sourceClientId} for delivery report`);
            }
        }
        else
            log.warn(`Cannot find message ${messageId} for delivery report`);

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

    private messageLoop = () => {
        if (this.loopBroken) return;
        try {
            for (const topic of this.topics.getActiveTopicsRandomized()) {
                let clientTarget: BrokerSocket | null = null;
                for (const client of this.clientList)
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
            setTimeout(this.messageLoop, 0);
        } catch (error) { log.error(error); }
    }
}
