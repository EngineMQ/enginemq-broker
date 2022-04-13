import * as net from 'node:net';
import { version as brokerVersion } from '../../package.json';
import { diff as semverDiff, major as semverMajor, ReleaseType } from 'semver';

import * as config from '../config';
import logger from './logger';
import * as messages from '../common/messageTypes';
import { validateObject } from '../common/lib/ajv';
import { MsgpackSocket } from '../common/lib/socket/MsgpackSocket';
import { MessageHandler } from './MessageHandler';
import { MessageStorageItem } from './storage/IStorage';
import { BufferedSocketOptions, defaultBufferedSocketOptions } from '../common/lib/socket/BufferedSocket';
import { topicStringToRegExpOrString } from './utility';
import { ILoginHandler } from './ResourceHandler';
import { Auth } from './resources/auth/Auth';

const log = logger.child({ module: 'Socket' });
let socketUniqueId = 1;

const HEARTBEAT_FREQ_PERCENT = 45;

export declare interface BrokerSocket {
    on(event: 'connect', listener: () => void): this;
    on(event: 'data', listener: (data: Buffer) => void): this;
    on(event: 'buffered_data', listener: (data: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'close', listener: (hadError: boolean) => void): this;
    on(event: 'obj_data', listener: (object: object) => void): this;

    on(event: 'subscriptions', listener: (subscriptions: (string | RegExp)[]) => void): this;
    on(event: 'mq-no-heartbeat', listener: () => void): this;
}
type ClientInfo = { uniqueId: number, clientId: string, auth?: Auth, version: string, maxWorkers: number };
export type AckFunction = (deliveryAck: messages.ClientMessageDeliveryAck) => boolean;
export class BrokerSocket extends MsgpackSocket {
    private messageHandler: MessageHandler;
    private loginHandler: ILoginHandler;
    private clientInfo: ClientInfo = { uniqueId: 0, clientId: '', version: '', maxWorkers: 1 };
    private subscriptions: (string | RegExp)[] = [];
    private lastRcvHeartbeat = Date.now();
    private lastSndHeartbeat = 0;
    private waitListForAck: { messageId: string, onAck: AckFunction }[] = [];

    constructor(socket: net.Socket, messageHandler: MessageHandler, loginHandler: ILoginHandler) {
        const options: BufferedSocketOptions = {
            ...defaultBufferedSocketOptions,
            maxPacketSize: {
                value: config.maxPacketSizeBytes,
                onExcept: (packetSize: number) => this.getLog().error({ size: packetSize, maxsize: config.maxPacketSizeBytes }, 'Packet size exceeded max value'),
            }

        };
        super(socket, options);
        this.messageHandler = messageHandler;
        this.loginHandler = loginHandler;

        this.on('obj_data', (object: object) => this.onObjData(object));
    }



    // Public

    public getClientInfo() {
        return {
            clientId: this.clientInfo.clientId,
            clientDetail: this.clientInfo,
            authDescription: this.clientInfo.auth ? this.clientInfo.auth.description : '',
            subscriptions: this.subscriptions,
            stat: this.getSocketStat(),
            address: this.getSocketAddressInfo().address,
            addressDetail: this.getSocketAddressInfo(),
        };
    }

    public override destroy() { super.destroy() }
    public override setKeepAlive(enable: boolean, initialDelay: number) { super.setKeepAlive(enable, initialDelay); }

    public processHeartbeat(sec: number) {
        const now = Date.now();
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
            else if (sub instanceof RegExp && sub.test(topic)) return true;
        return false;
    }

    public delivery(message: messages.BrokerMessageDelivery, onAck: AckFunction) {
        this.waitListForAck.push({ messageId: message.options.messageId, onAck: onAck });
        this.sendMessage('delivery', message);
    }

    public hasIdleWorker() {
        return this.waitListForAck.length < this.clientInfo.maxWorkers;
    }

    public sendDeliveryReport(report: messages.BrokerMessageDeliveryReport) {
        this.sendMessage('deliveryReport', report);
    }


    // Private
    private getLog = () => log.child({ client: this.getClientInfo().clientId, address: this.getSocketAddressInfo().address })

    private sendMessage(cm: messages.BrokerMessageType, object: object) {
        const dataMessage: { [name: string]: object } = {};
        dataMessage[cm as keyof object] = object;
        super.sendObj(dataMessage);
        this.lastSndHeartbeat = Date.now();

        this.getLog().debug({ type: cm, data: object }, 'Send message');
    }

    private onObjData(object: object) {
        if (Object.keys(object).length !== 1) return;

        const cmd = Object.keys(object)[0] as messages.ClientMessageType;
        const parameters = Object.values(object)[0] as object;

        this.lastRcvHeartbeat = Date.now();

        this.getLog().debug({ type: cmd, data: parameters }, 'Receive message');
        switch (cmd) {
            case 'login':
                const cmLogin = validateObject<messages.ClientMessageLogin>(messages.ClientMessageLogin, parameters);
                if (!cmLogin) return;

                try {
                    let auth: Auth | undefined;
                    if (cmLogin.authToken)
                        auth = this.loginHandler.getAuthByToken(cmLogin.authToken);
                    if (!this.loginHandler.isAnonymousMode() && !auth)
                        throw new Error('Authentication error');

                    const diff = semverDiff(cmLogin.version, brokerVersion);
                    if (diff && (['major', 'premajor'] as ReleaseType[]).includes(diff)) {
                        const requiredVersion = String(semverMajor(brokerVersion));
                        throw new Error(`Incompatible client version, required v${requiredVersion}.x.x`);
                    }

                    this.clientInfo = {
                        uniqueId: socketUniqueId++,
                        clientId: cmLogin.clientId,
                        auth: auth,
                        version: cmLogin.version,
                        maxWorkers: Math.max(Math.min(cmLogin.maxWorkers, config.maxClientWorkers), config.minWorkers),
                    };
                    const bmLoginAck: messages.BrokerMessageLoginAck = {
                        heartbeatSec: config.heartbeatSec,
                    };
                    this.sendMessage('loginAck', bmLoginAck);
                }
                catch (error) {
                    const bmLoginAck: messages.BrokerMessageLoginAck = {
                        heartbeatSec: 0,
                        errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    };
                    this.sendMessage('loginAck', bmLoginAck);
                }
                break;
            case 'heartbeat':
                if (validateObject<messages.ClientMessageHeartbeat>(messages.ClientMessageHeartbeat, parameters))
                    this.lastRcvHeartbeat = Date.now();
                break;
            case 'subscribe':
                const cmSubscribe = validateObject<messages.ClientMessageSubscribe>(messages.ClientMessageSubscribe, parameters);
                if (!cmSubscribe) return;

                this.updateSubscriptions(cmSubscribe.subscriptions);
                break;
            case 'publish':
                const cmPublish = validateObject<messages.ClientMessagePublish>(messages.ClientMessagePublish, parameters);
                if (!cmPublish) return;

                const mhItem: MessageStorageItem = {
                    topic: cmPublish.topic,
                    message: cmPublish.message,
                    options: cmPublish.options,

                    sourceClientId: this.clientInfo.clientId,
                    publishTime: Date.now(),
                };
                try {
                    this.messageHandler.addMessage(mhItem, { allowRouter: true, auth: this.clientInfo.auth })

                    const bmPublishAck: messages.BrokerMessagePublishAck = { messageId: cmPublish.options.messageId };
                    this.sendMessage('publishAck', bmPublishAck);
                }
                catch (error) {
                    const bmPublishAck: messages.BrokerMessagePublishAck = { messageId: cmPublish.options.messageId, errorMessage: error instanceof Error ? error.message : 'Unknown error' };
                    this.sendMessage('publishAck', bmPublishAck);
                }
                break;
            case 'deliveryAck':
                const cmDeliveryAck = validateObject<messages.ClientMessageDeliveryAck>(messages.ClientMessageDeliveryAck, parameters);
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

        const subscriptionResult = [];
        this.subscriptions = [];

        for (const sub of subscriptions) {
            if (messages.TOPIC_WILDCARD_MASK.test(sub) && sub.length <= messages.TOPIC_LENGTH_MAX) {
                if (!this.clientInfo.auth || this.clientInfo.auth.isValidSubscribeTopic(sub)) {
                    this.subscriptions.push(topicStringToRegExpOrString(sub));
                    subscriptionResult.push({ topic: sub, errorMessage: undefined });
                }
                else
                    subscriptionResult.push({ topic: sub, errorMessage: 'Do not have permission to subscribe' });
            }
            else
                subscriptionResult.push({ topic: sub, errorMessage: 'Invalid topic format' });
        }

        this.emit('subscriptions', this.subscriptions);

        const bmSubscribeAck: messages.BrokerMessageSubscribeAck = { errors: subscriptionResult };
        this.sendMessage('subscribeAck', bmSubscribeAck);
    }
}