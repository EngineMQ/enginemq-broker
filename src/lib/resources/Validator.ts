import { IResource } from './IResource';
import { topicStringToRegExpOrString } from '../utility';

type ErrorResult = string;

export type ValidatorOptions = {
    name: string,
    topic: string,
}
export class Validator implements IResource {
    private _name: string;
    private topic: string | RegExp;

    get description(): string {
        return this._name;
    }

    constructor(options: ValidatorOptions) {
        this._name = options.name;
        this.topic = topicStringToRegExpOrString(options.topic);
    }

    public matchTopic(topic: string): boolean {
        if (typeof this.topic === 'string') {
            if (this.topic.toLowerCase() === topic.toLowerCase())
                return true;
        }
        else if (this.topic instanceof RegExp && this.topic.test(topic))
            return true;
        return false;

    }

    public validate(message: object): ErrorResult | undefined {
        message.toString() + this.description;
        return;
    }
}
