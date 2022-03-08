import { EventEmitter } from 'stream';

import logger from './logger';
import { BrokerSocket } from './BrokerSocket';
import { shuffleArray } from './utility';

const log = logger.child({ module: 'ClientList' });

export declare interface ClientList {
    on(event: 'add', listener: (socket: BrokerSocket) => void): this;
    on(event: 'remove', listener: (socket: BrokerSocket) => void): this;
}
export class ClientList extends EventEmitter {
    private heartbeatSec = 0;
    private clients: BrokerSocket[] = [];
    [Symbol.iterator]() { return shuffleArray(this.clients)[Symbol.iterator](); }

    constructor(heartbeatSec: number) {
        super();
        this.initHeartbeat(heartbeatSec);
    }

    private initHeartbeat(sec: number) {
        this.heartbeatSec = sec;
        if (!sec) return;
        setInterval(() => {
            for (const client of this.clients)
                client.processHeartbeat(sec)
        }, sec * 100);
    }

    public add(client: BrokerSocket) {
        if (this.heartbeatSec)
            client.setKeepAlive(true, this.heartbeatSec / 2 * 1000);
        this.clients.push(client);
        log.debug(client.getClientInfo().addressInfo, 'Client connected');
        this.emit('add', client);
        client.on('close', () => {
            const index = this.clients.indexOf(client);
            if (index >= 0) {
                const clientToRemove = this.clients[index];
                this.clients.splice(index, 1);
                log.debug(client.getClientInfo().addressInfo, 'Client disconnected');
                this.emit('remove', clientToRemove);
            }
        });
    }

    public get length() { return this.clients.length }

    public getSocket(index: number): BrokerSocket | undefined {
        return this.clients[index] || undefined
    }

    public getSocketByClientId(clientId: string): BrokerSocket | undefined {
        return this.clients.find((client) => client.getClientInfo().info.clientId == clientId)
    }

    public destroyAll = () => this.clients.forEach((client) => client.destroy())
}
