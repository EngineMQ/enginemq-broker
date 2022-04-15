/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/require-await */
import * as fs from 'node:fs';
import type { SessionData } from '@mgcrea/fastify-session';

type SessionFileEntry = {
    sid: string,
    value: SessionData,
}
export class SessionStoreLocal {
    private filename: string;
    private data: Map<string, SessionData>;

    constructor(filename: string) {
        this.filename = filename;
        this.data = new Map<string, SessionData>();

        this.load();
    }

    private load() {
        if (fs.existsSync(this.filename))
            try {
                const buffer = fs.readFileSync(this.filename);
                const fileData: SessionFileEntry[] = JSON.parse(buffer.toString());
                for (const d of fileData)
                    this.data.set(d.sid, d.value);
            }
            catch { this.data.clear(); }
    }

    private save() {
        const fileData = [...this.data.keys()]
            .map(k => {
                return {
                    sid: k,
                    value: this.data.get(k) as SessionData
                }
            });
        fs.writeFileSync(this.filename, JSON.stringify(fileData));
    }

    public async get(sid: string): Promise<[SessionData, number | null] | null> {
        return [this.data.get(sid) as SessionData, null];
    }
    public async set(sid: string, session: SessionData, expiry?: number | null): Promise<void> {
        expiry;
        this.data.set(sid, session);
        this.save();
    }
    public async destroy(sid: string): Promise<void> {
        this.data.delete(sid);
        this.save();
    }
    public async all?(): Promise<SessionData[] | { [sid: string]: SessionData; } | null> {
        return [...this.data.values()];
    }
    public async length?(): Promise<number> {
        return this.data.size;
    }
    public async clear?(): Promise<void> {
        this.data.clear();
        this.save();
    }
    public async touch?(sid: string, expiry?: number | null): Promise<void> {
        sid; expiry;
    }
}
