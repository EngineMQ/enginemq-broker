import { IResource } from "./IResource";
import { topicStrToRegexpOrString } from "../utility";

type ErrorResult = string;

export type ValidatorOptions = {
    name: string,
    topic: string,
}
export class Validator implements IResource {
    private _name: string;
    private topic: string | RegExp;

    get name(): string {
        return this._name;
    }

    constructor(options: ValidatorOptions) {
        this._name = options.name;
        this.topic = topicStrToRegexpOrString(options.topic);
    }

    public matchTopic(topic: string): boolean {
        if (typeof this.topic === 'string') {
            if (this.topic.toLowerCase() === topic.toLowerCase())
                return true;
        }
        else if (this.topic instanceof RegExp) {
            if (this.topic.test(topic))
                return true;
        }
        return false;

    }

    public validate(msg: object): ErrorResult | null {
        msg.toString() + this.name;
        return null;
    }
}
