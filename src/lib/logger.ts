/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Writable } from 'node:stream'
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

export type MemoryLogUiNotificationItem = {
    level: string,
    icon: string,
    iconClass: string,
    itemCount: number,
}

const uiNotificationLevels = [
    { level: 'error', icon: 'fa-times', iconClass: 'danger' },
    { level: 'warn', icon: 'fa-exclamation-triangle', iconClass: 'warning' },
];

const levelSorter = (levelA: string, levelB: string) => {
    const levelSort = ['error', 'warn', 'info'];

    const indexA = Math.min(levelSort.indexOf(levelA), Number.MAX_SAFE_INTEGER);
    const indexB = Math.min(levelSort.indexOf(levelB), Number.MAX_SAFE_INTEGER);
    return indexA - indexB;
}

class MemoryLogStore {
    private logs = new Map<string, MemoryLogItem[]>();
    private hasUiNotification = false;

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

            if (uiNotificationLevels.some((notifyLevel) => notifyLevel.level == level))
                this.hasUiNotification = true;
        }
    }

    public getUiNotification(): MemoryLogUiNotificationItem[] {
        if (!this.hasUiNotification)
            return [];

        const result: MemoryLogUiNotificationItem[] = [];
        for (const nl of uiNotificationLevels) {
            const items = this.logs.get(nl.level);
            if (items)
                result.push({ level: nl.level, icon: nl.icon, iconClass: nl.iconClass, itemCount: items.length });
        }
        return result;
    }

    public clear() {
        this.logs.clear();
        this.hasUiNotification = false;
    }

    public getMessages(level: string): MemoryLogItem[] {
        const items = this.logs.get(level);
        if (items)
            return items;
        return [];
    }

    public getLevels(): Record<string, number> {
        const result: Record<string, number> = {};

        const keys = [...this.logs.keys()];
        keys.sort(levelSorter);

        for (const key of keys)
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

    public override _write(chunk: any, _encoding: string, callback: (error?: Error | undefined) => void) {
        try {
            const logObject = JSON.parse(chunk.toString() as string);
            delete logObject.hostname;
            delete logObject.pid;
            delete logObject.name;

            const logExtendedData = Object.assign({}, logObject);
            delete logExtendedData.level;
            delete logExtendedData.time;
            delete logExtendedData.module;
            delete logExtendedData.msg;

            this.store.add({
                level: logObject.level as string,
                time: logObject.time as number,
                module: logObject.module as string,
                text: logObject.msg as string,
                data: logExtendedData as object
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
        err(error: Error) {
            if (config.isProduction)
                delete error.stack;
            return pino.stdSerializers.err(error);
        }
    },
}, pino.multistream([
    { stream: new MemoryLogStream(memoryLogStore) },
    { stream: process.stdout },
]));
