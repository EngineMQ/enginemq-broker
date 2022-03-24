import * as net from 'net';
import { version } from '../../package.json';

import * as config from '../config';
import logger from './logger';
import * as messages from '../common/messageTypes';
import { validateObject } from '../common/lib/ajv';
import { MsgpackSocket } from '../common/lib/socket/MsgpackSocket';
import { MessageHandler } from './MessageHandler';
import { MessageStorageItem } from './storage/IStorage';
import { BufferedSocketOptions, defaultBufferedSocketOptions } from '../common/lib/socket/BufferedSocket';
import { topicStrToRegexpOrString } from './utility';

const nowMs = () => new Date().getTime();
const log = logger.child({ module: 'Socket' });
let socketUniqueId = 1;

const HEARTBEAT_FREQ_PERCENT = 45;

export declare interface BrokerSocket {
    on(event: 'connect', listener: () => void): this;
    on(event: 'data', listener: (data: Buffer) => void): this;
    on(event: 'buffered_data', listener: (data: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'close', listener: (hadError: boolean) => void): this;
    on(event: 'obj_data', listener: (obj: object) => void): this;

    on(event: 'subscriptions', listener: (subscriptions: (string | RegExp)[]) => void): this;
    on(event: 'mq-no-heartbeat', listener: () => void): this;
}
export type AckFn = (deliveryAck: messages.ClientMessageDeliveryAck) => boolean;
export class BrokerSocket extends MsgpackSocket {
    private messageHandler: MessageHandler;
    private clientInfo = { uniqueId: 0, clientId: '', version: '', maxWorkers: 1 };
    private subscriptions: (string | RegExp)[] = [];
    private lastRcvHeartbeat = nowMs();
    private lastSndHeartbeat = 0;
    private waitListForAck: { messageId: string, onAck: AckFn }[] = [];

    constructor(socket: net.Socket, messageHandler: MessageHandler) {
        const options: BufferedSocketOptions = {
            ...defaultBufferedSocketOptions,
            ...{
                maxPacketSize: {
                    value: config.maxPacketSizeBytes,
                    onExcept: (packetSize: number) => this.getLog().error({ size: packetSize, maxsize: config.maxPacketSizeBytes }, 'Packet size exceeded max value'),
                }
            }
        };
        super(socket, options);
        this.messageHandler = messageHandler;

        this.on('obj_data', (obj: object) => this.onObjData(obj));
    }



    // Public

    public getClientInfo() {
        return {
            clientId: this.clientInfo.clientId,
            clientDetail: this.clientInfo,
            subscriptions: this.subscriptions,
            stat: this.getSocketStat(),
            address: this.getSocketAddressInfo().address,
            addressDetail: this.getSocketAddressInfo(),
        };
    }

    public override destroy() { super.destroy() }
    public override setKeepAlive(enable: boolean, initialDelay: number) { super.setKeepAlive(enable, initialDelay); }

    public processHeartbeat(sec: number) {
        const now = nowMs();
        if (now - this.lastSndHeartbeat > sec * 1000 / 100 * HEARTBEAT_FREQ_PERCENT) {
            const brHeatbeat: messages.BrokerMessageHeartbeat = {};
            this.sendMessage('heartbeat', brHeatbeat);
            this.lastSndHeartbeat = now;
        }
        if (now - this.lastRcvHeartbeat > sec * 1000) {
            this.emit('mq-no-heartbeat');
            this.destroy();
        }
    }

    public matchSubscription(topic: string): boolean {
        for (const sub of this.subscriptions)
            if (typeof sub === 'string') {
                if (sub.toLowerCase() === topic.toLowerCase())
                    return true;
            }
            else if (sub instanceof RegExp) {
                if (sub.test(topic))
                    return true;
            }
        return false;
    }

    public delivery(message: messages.BrokerMessageDelivery, onAck: AckFn) {
        this.waitListForAck.push({ messageId: message.options.messageId, onAck: onAck });
        this.sendMessage("delivery", message);
    }

    public hasEnoughWorker() {
        return this.waitListForAck.length < this.clientInfo.maxWorkers;
    }

    public sendDeliveryReport(report: messages.BrokerMessageDeliveryReport) {
        this.sendMessage("deliveryreport", report);
    }


    // Private
    private getLog = () => log.child({ client: this.getClientInfo().clientId, address: this.getSocketAddressInfo().address })

    private sendMessage(cm: messages.BrokerMessageType, obj: object) {
        const dataMessage: { [name: string]: object } = {};
        dataMessage[cm as keyof object] = obj;
        super.sendObj(dataMessage);
        this.lastSndHeartbeat = nowMs();

        this.getLog().debug({ type: cm, data: obj }, 'Send message');
    }

    private onObjData(obj: object) {
        if (Object.keys(obj).length !== 1) return;

        const cmd = Object.keys(obj)[0] as messages.ClientMessageType;
        const params = Object.values(obj)[0] as object;

        this.lastRcvHeartbeat = nowMs();

        this.getLog().debug({ type: cmd, data: params }, 'Receive message');
        switch (cmd) {
            case 'hello':
                const cmHello = validateObject<messages.ClientMessageHello>(messages.ClientMessageHello, params);
                if (!cmHello) return;

                this.clientInfo = {
                    uniqueId: socketUniqueId++,
                    clientId: cmHello.clientId,
                    version: cmHello.version,
                    maxWorkers: Math.max(Math.min(cmHello.maxWorkers, config.maxClientWorkers), config.minWorkers),
                };

                const bmWelcome: messages.BrokerMessageWelcome = { version: version, heartbeatSec: config.heartbeatSec };
                this.sendMessage("welcome", bmWelcome);
                break;
            case 'heartbeat':
                if (validateObject<messages.ClientMessageHeartbeat>(messages.ClientMessageHeartbeat, params))
                    this.lastRcvHeartbeat = nowMs();
                break;
            case 'subscribe':
                const cmSubscribe = validateObject<messages.ClientMessageSubscribe>(messages.ClientMessageSubscribe, params);
                if (!cmSubscribe) return;

                this.updateSubscriptions(cmSubscribe.subscriptions);
                break;
            case 'publish':
                const cmPublish = validateObject<messages.ClientMessagePublish>(messages.ClientMessagePublish, params);
                if (!cmPublish) return;

                const mhItem: MessageStorageItem = {
                    topic: cmPublish.topic,
                    message: cmPublish.message,
                    options: cmPublish.options,

                    sourceClientId: this.clientInfo.clientId,
                    publishTime: nowMs(),
                };
                try {
                    this.messageHandler.addMessage(mhItem)

                    const bmPublishAck: messages.BrokerMessagePublishAck = { messageId: cmPublish.options.messageId };
                    this.sendMessage("publishAck", bmPublishAck);
                }
                catch (error) {
                    const bmPublishAck: messages.BrokerMessagePublishAck = { messageId: cmPublish.options.messageId, errorMessage: error instanceof Error ? error.message : 'Unknown error' };
                    this.sendMessage("publishAck", bmPublishAck);
                }
                break;
            case 'deliveryAck':
                const cmDeliveryAck = validateObject<messages.ClientMessageDeliveryAck>(messages.ClientMessageDeliveryAck, params);
                if (!cmDeliveryAck) return;

                const messageId = cmDeliveryAck.messageId;
                const ackIndex = this.waitListForAck.findIndex((item) => item.messageId == messageId);
                if (ackIndex >= 0) {
                    const ackItem = this.waitListForAck[ackIndex];
                    if (ackItem ? ackItem.onAck(cmDeliveryAck) : true)
                        this.waitListForAck.splice(ackIndex, 1);
                }
                break;
        }
    }

    private updateSubscriptions(subscriptions: string[]) {
        this.getLog().debug({ subscriptions }, 'Update subscriptions');
        this.subscriptions = [];
        for (const sub of subscriptions)
            this.subscriptions.push(topicStrToRegexpOrString(sub));
        this.emit('subscriptions', this.subscriptions);
    }
}