import { EventEmitter } from 'node:stream';

import logger from './logger';
import { BrokerSocket } from './BrokerSocket';
import { shuffleArray } from './utility';

const log = logger.child({ module: 'Clients' });

export declare interface ClientList {
    on(event: 'add', listener: (socket: BrokerSocket) => void): this;
    on(event: 'remove', listener: (socket: BrokerSocket) => void): this;
}
export class ClientList extends EventEmitter {
    private heartbeatSec = 0;
    private timerHeartbeat = 0;
    private clients: BrokerSocket[] = [];
    //[Symbol.iterator]() { return shuffleArray(this.clients)[Symbol.iterator](); }
    [Symbol.iterator]() { return this.clients[Symbol.iterator](); }

    constructor(heartbeatSec: number) {
        super();

        this.heartbeatSec = heartbeatSec;
        if (heartbeatSec)
            this.timerHeartbeat = setInterval(() => {
                for (const client of this.clients)
                    client.processHeartbeat(heartbeatSec)
            }, heartbeatSec * 100) as unknown as number;
    }

    public close() {
        if (this.timerHeartbeat)
            clearInterval(this.timerHeartbeat);
        this.destroyAll();
    }

    public add(client: BrokerSocket) {
        if (this.heartbeatSec)
            client.setKeepAlive(true, this.heartbeatSec / 2 * 1000);
        this.clients.push(client);
        log.debug(client.getClientInfo().addressDetail, 'Client connected');
        this.emit('add', client);
        client.on('close', () => {
            const index = this.clients.indexOf(client);
            if (index >= 0) {
                const clientToRemove = this.clients[index];
                this.clients.splice(index, 1);
                log.debug(client.getClientInfo().addressDetail, 'Client disconnected');
                this.emit('remove', clientToRemove);
            }
        });
    }

    public get length() { return this.clients.length }

    public getItems() {
        return this.clients;
    }

    public getRandomized(): IterableIterator<BrokerSocket> {
        return shuffleArray(this.clients)[Symbol.iterator]();
    }

    public getSocket(index: number): BrokerSocket | undefined {
        return this.clients[index] || undefined
    }

    public getSocketByClientId(clientId: string): BrokerSocket | undefined {
        return this.clients.find((client) => client.getClientInfo().clientId == clientId)
    }

    public destroy(uniqueId: number) {
        const bs = this.clients.find((cli) => cli.getClientInfo().clientDetail.uniqueId == uniqueId);
        if (bs)
            bs.destroy();
    }

    public destroyAll = () => {
        for (const client of this.clients)
            client.destroy()
    }
}
