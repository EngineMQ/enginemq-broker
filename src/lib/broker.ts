import * as net from 'node:net';

import * as config from '../config';
import logger from './logger';
import { ClientList } from './ClientList';
import storageConfig from './storage/storageConfig';
import { IStorage } from './storage/IStorage';
import { MessageHandler } from './MessageHandler';
import { BrokerSocket } from './BrokerSocket';
import { TopicHandler } from './TopicHandler';
import { ResourceHandler } from './ResourceHandler';
import { ResourceOriginHandler } from './ResourceOriginHandler';

const log = logger.child({ module: 'Main' });

const clientList = new ClientList(config.heartbeatSec);

let messageHandler: MessageHandler;
let topics: TopicHandler;
let server: net.Server;
let storage: IStorage;
let resourceHandler: ResourceHandler;
let resourceOriginHandler: ResourceOriginHandler | undefined;

export const createBroker = async (storageOverride?: string): Promise<{
    server: net.Server,
    clientList: ClientList,
    messageHandler: MessageHandler,
    topics: TopicHandler,
    storage: IStorage
    resourceHandler: ResourceHandler,
    resourceOriginHandler: ResourceOriginHandler | undefined,
}> => {
    log.info('Init broker');

    topics = new TopicHandler();
    storage = storageConfig(storageOverride || config.storage);
    resourceHandler = new ResourceHandler(storage);
    if (config.resourceOrigin) {
        resourceOriginHandler = new ResourceOriginHandler(resourceHandler, config.resourceOrigin);
        await resourceOriginHandler.start();
    }
    messageHandler = new MessageHandler(clientList, storage, topics, resourceHandler);
    await messageHandler.loadMessages()
        .then(() => {
            server = net.createServer((socket: net.Socket) => clientList.add(new BrokerSocket(socket, messageHandler, resourceHandler)));
            server
                .on('listening', () => {
                    const addr = server.address() as net.AddressInfo;
                    log.info(`Broker started on ${addr.address}:${addr.port}`)
                    messageHandler.startLoop();
                })
                .on('error', (error) => { throw error })
                .listen(config.brokerPort, config.brokerHost);
        })

    return {
        server: server,
        clientList: clientList,
        messageHandler: messageHandler,
        topics: topics,
        storage: storage,
        resourceHandler: resourceHandler,
        resourceOriginHandler: resourceOriginHandler,
    };
}

export const closeBroker = async () => {
    log.info('Broker shutdown');
    return new Promise((resolve, reject) => {
        log.info('Stop messageloop');
        messageHandler.close();

        if (resourceOriginHandler) {
            log.info('Stop resource origin');
            resourceOriginHandler.stop();
        }

        log.info('Stop storage');
        storage.close();

        log.info('Disconnect clients');
        clientList.close();

        if (!server.listening)
            reject();
        server.close((error) => {
            if (error) {
                log.error('Broker stop failed: ' + error.message);
                reject(error);
            }
            else {
                log.info('Broker stopped');
                resolve(server);
            }
        });
    })
}
