import { customAlphabet } from 'nanoid';

import logger from './logger';
import { ClientList } from './ClientList';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { TopicHandler } from './TopicHandler';
import * as types from '../common/messageTypes';
import * as utility from './utility';
import { AckFunction, BrokerSocket } from './BrokerSocket';
import { ResourceHandler } from './ResourceHandler';

const log = logger.child({ module: 'Messages' });

class MessageError extends Error { }

type MessageId = string;
type Topic = string;

const GARBAGE_SEC = 60;
const GARBAGE_BOOST_SEC = 15;
const GARBAGE_LIMIT = 1000;
const MESSAGELOOP_BOOST_ITERATIONS = 100;

const nanoid = customAlphabet(types.MESSAGE_ID_ALPHABET, types.MESSAGE_ID_LENGTH_DEFAULT);
const messageIdRegExp = new RegExp(types.MESSAGE_ID_MASK);

export class MessageHandler {
    private timerExpiredMessages = 0;
    private timerMessageLoop = 0;
    private clientList: ClientList;
    private storage: IStorage;
    private topics: TopicHandler;
    private resourceHandler: ResourceHandler;
    private topicIndexerList = new Map<MessageId, Topic>();
    private messageIndexerList = new Map<MessageId, MessageStorageItem>();
    private underDeliveryList = new Map<MessageId, BrokerSocket>();

    constructor(clientList: ClientList, storage: IStorage, topics: TopicHandler, resourceHandler: ResourceHandler) {
        this.clientList = clientList;
        this.storage = storage;
        this.topics = topics;
        this.resourceHandler = resourceHandler;

        this.clientList.on('remove', (socket: BrokerSocket) => this.onReleaseClient(socket))
        this.timerExpiredMessages = setTimeout(() => this.removeSomeExpiredMessages(), GARBAGE_SEC * 1000) as unknown as number;
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
                        if (loadList.length > 0) {
                            const now = Date.now();

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
                        utility.gc();
                        resolve();
                    });
            }
            catch (error) { reject(error); }
        });
    }

    public addMessage(item: MessageStorageItem, allowRouter = true) {
        try {
            if (!item.options.messageId)
                item.options.messageId = nanoid();

            if (!item.topic)
                throw new MessageError('Missing topic');
            if (!messageIdRegExp.test(item.options.messageId))
                throw new MessageError(`Invalid messageId format: ${item.options.messageId}`);
            if (item.options.delayMs && item.options.delayMs < 0)
                throw new MessageError(`Invalid delayMs value: ${item.options.delayMs}`);
            if (item.options.expirationMs && item.options.expirationMs < 0)
                throw new MessageError(`Invalid expirationMs value: ${item.options.expirationMs}`);

            const topicOfExistingItem = this.topicIndexerList.get(item.options.messageId);
            if (topicOfExistingItem)
                this.topics.removeMessage(topicOfExistingItem, item.options.messageId);

            const addMessageFunction = (_msgitem: MessageStorageItem) => {
                this.topics.addMessage(_msgitem.topic, _msgitem);
                this.topicIndexerList.set(_msgitem.options.messageId, _msgitem.topic);
                this.messageIndexerList.set(_msgitem.options.messageId, _msgitem)
                this.storage.addOrUpdateMessage(_msgitem.options.messageId, _msgitem);
            };

            if (!allowRouter)
                addMessageFunction(item);
            else {
                const routerResult = this.resourceHandler.runRouterChain(item);

                if (routerResult.includes(item.topic))
                    addMessageFunction(item);

                let newMessageIndex = 0;
                for (const newTopic of routerResult.filter((r) => r != item.topic)) {
                    newMessageIndex++;
                    const newMessageId = `${item.options.messageId}-${newMessageIndex}`
                    const newMessage = this.cloneMessageForRouter(item, newTopic, newMessageId);
                    addMessageFunction(newMessage);
                }
            }
        } catch (error) {
            log.error(error);
            throw error;
        }
    }

    private loopBroken = false;
    public startLoop() {
        this.loopBroken = false;
        this.timerMessageLoop = setTimeout(this.messageLoop, 0) as unknown as number;
    }

    public close() {
        this.loopBroken = true;
        if (this.timerExpiredMessages)
            clearTimeout(this.timerExpiredMessages);
        if (this.timerMessageLoop)
            clearTimeout(this.timerMessageLoop);
    }

    public deleteTopicAllMessage(topic: Topic) {
        log.debug('Delete topic all messages');

        const exmsgids = this.topics.getTopicMessageIds(topic);
        if (exmsgids.length > 0) {
            const measureTime = new utility.MeasureTime();
            const originalCount = exmsgids.length;
            for (const messageId of exmsgids) {
                this.storage.deleteMessage(messageId);

                this.underDeliveryList.delete(messageId);

                this.topics.removeTopicAllMessages(topic);
                this.topicIndexerList.delete(messageId);
                this.messageIndexerList.delete(messageId);
            }
            measureTime.measure('delete');
            measureTime.writeLog((valuestr: string[]) => log.info({ total: originalCount, times: valuestr }, 'Delete bulk messages'));
        }
    }



    // Private

    private getMessage(messageId: string): MessageStorageItem | undefined {
        return this.messageIndexerList.get(messageId) || undefined;
    }

    private resendMessage(messageId: string, delayMs: number) {
        log.debug({ messageid: messageId }, 'Resend message');
        try {
            const message = this.messageIndexerList.get(messageId);
            if (message) {
                message.publishTime = Date.now();
                message.options.delayMs = delayMs;
                this.addMessage(message, false);
            }
            else
                throw new MessageError(`Message not found: ${messageId}`);
        }
        catch {
            log.error({ messageid: messageId }, 'Cannot resend message');
        }
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
            log.error({ messageid: messageId }, 'Cannot delete message, topic not found');
    }

    private cloneMessageForRouter(message: MessageStorageItem, newTopic: string, newMessageId: string): MessageStorageItem {
        const result = {
            topic: newTopic,
            message: Object.assign({}, message.message),
            options: Object.assign({}, message.options),
            publishTime: message.publishTime,
            sourceClientId: message.sourceClientId,
        }
        // const result = structuredClone(msg);
        // result.topic = newTopic;
        result.options.messageId = newMessageId;
        return result;
    }

    private removeSomeExpiredMessages() {
        log.debug('Gargabe start');

        const measureTime = new utility.MeasureTime();
        const exmsgids = this.topics
            .getSomeExpiredMessages()
            .slice(0, GARBAGE_LIMIT);
        measureTime.measure('collect');

        if (exmsgids.length > 0) {
            const originalCount = this.messageIndexerList.size;
            for (const exmsgid of exmsgids)
                this.deleteMessage(exmsgid);
            measureTime.measure('remove');
            measureTime.writeLog((valuestr: string[]) => log.info({ expired: exmsgids.length, total: originalCount, times: valuestr }, 'Garbage expired messages'));
        }

        this.timerExpiredMessages = setTimeout(() => this.removeSomeExpiredMessages(),
            exmsgids.length == GARBAGE_LIMIT ?
                GARBAGE_BOOST_SEC * 1000 :
                GARBAGE_SEC * 1000) as unknown as number;
    }

    private onReleaseClient(socket: BrokerSocket) {
        log.debug({ client: socket.getClientInfo().clientId, address: socket.getClientInfo().address }, 'Release client messages');
        for (const [key, value] of this.underDeliveryList.entries()) {
            if (value == socket) {
                this.underDeliveryList.delete(key);
                log.debug({ messageid: key }, 'Delivered message moved back to list');
            }
        }
    }

    private createMessageLoopDeliveryAck: AckFunction = (deliveryAck: types.ClientMessageDeliveryAck) => {
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
                let clientTarget: BrokerSocket | undefined;
                for (const client of this.clientList.getRandomized())
                    if (client.matchSubscription(topic) && client.hasEnoughWorker()) {
                        clientTarget = client;
                        break;
                    }
                if (!clientTarget)
                    continue;

                let messageTarget: MessageStorageItem | undefined;
                for (const message of this.topics.getNextAvailableMessageIterator(topic))
                    if (message && !this.underDeliveryList.has(message.options.messageId)) {
                        messageTarget = message;
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
                this.timerMessageLoop = setTimeout(this.messageLoop, 0) as unknown as number;
                this.boostCount = 0;
            }
            else
                setImmediate(this.messageLoop);

        } catch (error) { log.error(error); }
    }
}
