import { customAlphabet } from 'nanoid';

import { IResource } from '../IResource';
import { AuthOptions, validateOptions } from './types';
import { getLatestYaml } from './yaml';

export const AUTHTOKEN_LENGTH_MAX = 128;
export const AUTHTOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const AUTHTOKEN_MASK = `^[${AUTHTOKEN_ALPHABET}]{1,${AUTHTOKEN_LENGTH_MAX}}$`;
export const AUTHTOKEN_LENGTH_DEFAULT = 32;
export const AUTHTOKEN_MASK_REGEXP = new RegExp(AUTHTOKEN_MASK);

const nanoid = customAlphabet(AUTHTOKEN_ALPHABET, AUTHTOKEN_LENGTH_DEFAULT);

export class Auth implements IResource {
    private options: AuthOptions;

    get description(): string {
        return this.options.description;
    }

    get token(): string {
        return this.options.token;
    }

    get maskedToken(): string {
        if (!this.options.token)
            return '';
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        return `${this.options.token.slice(0, 3)}...${this.options.token.slice(-3)}`;
    }

    get webAccess(): boolean {
        return this.options.webAccess;
    }

    constructor(options: AuthOptions) {
        this.options = this.setOptions(options);
    }

    public getOptions(): AuthOptions {
        return this.options;
    }

    public static generateNewToken(): string { return nanoid(); }

    public static checkOptions(options: AuthOptions): void { validateOptions(options); }

    public setOptions(options: AuthOptions): AuthOptions {
        validateOptions(options);

        this.options = options;

        for (const targets of [this.options.publishTo, this.options.subscribeTo])
            if (targets && Array.isArray(targets))
                targets.sort();
        return options;
    }

    public getYaml(resourceId: string): string {
        return getLatestYaml(resourceId, this.options);
    }

    public isValidPublishTopic(topic: string): boolean {
        if (Array.isArray(this.options.publishTo)) {
            for (const pt of this.options.publishTo)
                if (pt.toLowerCase() === topic.toLowerCase())
                    return true;
        }
        else
            if (this.options.publishTo?.toLowerCase() === topic.toLowerCase())
                return false;
        return false;
    }

    public isValidSubscribeTopic(topic: string): boolean {
        if (Array.isArray(this.options.subscribeTo)) {
            for (const pt of this.options.subscribeTo)
                if (pt.toLowerCase() === topic.toLowerCase())
                    return true;
        }
        else
            if (this.options.subscribeTo?.toLowerCase() === topic.toLowerCase())
                return false;
        return false;
    }

    public getTopicsCount() {
        return {
            // eslint-disable-next-line @typescript-eslint/no-extra-parens
            publishTo: Array.isArray(this.options.publishTo) ? this.options.publishTo.length : (this.options.publishTo ? 1 : 0),
            // eslint-disable-next-line @typescript-eslint/no-extra-parens
            subscribeTo: Array.isArray(this.options.subscribeTo) ? this.options.subscribeTo.length : (this.options.subscribeTo ? 1 : 0),
        }
    }

}
