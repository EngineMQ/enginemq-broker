import * as net from 'net';

import * as config from '../config';
import logger from './logger';
import { ClientList } from './ClientList';
import { LocalStorage } from './storage/LocalStorage';
import { IStorage } from './storage/IStorage';
import { MessageHandler } from './MessageHandler';
import { BrokerSocket } from './BrokerSocket';

const log = logger.child({ module: 'Main' });

const clientList = new ClientList(config.heartbeatSec);

let messageHandler: MessageHandler;
let server: net.Server;

export const createBroker = async () => {
    log.info('Init broker');

    const storage: IStorage = new LocalStorage(config.dataFolder);
    messageHandler = new MessageHandler(clientList, storage);
    server = net.createServer((socket: net.Socket) => clientList.add(new BrokerSocket(socket, messageHandler)));

    return new Promise((resolve, reject) => {
        server
            .on('listening', () => {
                const addr = server.address() as net.AddressInfo;
                log.info(`Broker started on ${addr.address}:${addr.port}`)
                resolve(server);
                messageHandler.startLoop();
            })
            .on('error', (error) => reject(error))
            .listen(config.brokerPort, config.brokerHost);
    })
}

export const closeBroker = async () => {
    log.info('Broker shutdown');
    return new Promise((resolve, reject) => {
        log.info('Stop messageloop');
        messageHandler.breakLoop();

        log.info('Disconnect clients');
        clientList.destroyAll();

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
