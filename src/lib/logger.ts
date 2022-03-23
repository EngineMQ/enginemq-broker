/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Writable } from "stream"
import { pino } from 'pino';

import * as config from '../config';

export const MEMORYLOG_MAX_ITEMS = 100;

export type MemoryLogItem = {
    level: string,
    time: number,
    module: string,
    text: string,
    data: object
}

class MemoryLogStore {
    private logs = new Map<string, MemoryLogItem[]>();

    public add(item: MemoryLogItem) {
        const level = item.level;
        if (level) {
            if (!this.logs.has(level))
                this.logs.set(level, []);

            const items = this.logs.get(level);
            if (items) {
                items.push(item);
                if (items.length > MEMORYLOG_MAX_ITEMS)
                    items.splice(0, items.length - MEMORYLOG_MAX_ITEMS);
            }
        }
    }

    public getMessages(level: string): MemoryLogItem[] {
        const items = this.logs.get(level);
        if (items)
            return items;
        return [];
    }

    public getLevels(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const key of this.logs.keys())
            result[key] = this.getMessages(key).length;
        return result;
    }
}

export const memoryLogStore = new MemoryLogStore();

class MemoryLogStream extends Writable {
    private store: MemoryLogStore;

    constructor(store: MemoryLogStore) {
        super({});
        this.store = store;
    }

    public override _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void) {
        try {
            const logObject = JSON.parse(chunk.toString() as string);
            delete logObject.hostname;
            delete logObject.pid;
            delete logObject.name;

            const logExt = Object.assign({}, logObject);
            delete logExt.level;
            delete logExt.time;
            delete logExt.module;
            delete logExt.msg;

            this.store.add({
                level: logObject.level as string,
                time: logObject.time as number,
                module: logObject.module as string,
                text: logObject.msg as string,
                data: logExt as object
            });
        }
        catch (error) { error; }
        callback();
    }
}

export default pino({
    name: config.serviceName,
    level: config.logLevel,
    formatters: {
        level(label) {
            return { level: label }
        }
    },
    serializers: {
        req(request) {
            return {
                method: request.method,
                url: request.url,
                path: request.path,
                parameters: request.parameters,
                body: request.body,
            };
        },
        res(reply) {
            return {
                statusCode: reply.statusCode,
                headers: reply.headers,
                payload: reply.payload,
            };
        },
    },
}, pino.multistream([
    { stream: new MemoryLogStream(memoryLogStore) },
    { stream: process.stdout },
]));
