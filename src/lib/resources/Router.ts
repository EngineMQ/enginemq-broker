import { IResource } from "./IResource";
// import { topicStrToRegexpOrString } from "../utility";
import { Static, Type } from "@sinclair/typebox";

const NAME_LENGTH_MAX = 32;
const NAME_MASK = `^[a-z0-9-]{1,${NAME_LENGTH_MAX}}$`;

export type RouterOptions = Static<typeof RouterOptions>;
export const RouterOptions = Type.Object({
    name: Type.String(),
    topic: Type.String(),
    moveTo: Type.Optional(
        Type.Union([
            Type.String(),
            Type.Array(Type.String())
        ])),
    copyTo: Type.Optional(
        Type.Union([
            Type.String(),
            Type.Array(Type.String())
        ])),
});

export class Router implements IResource {
    private options: RouterOptions;
    // private inputTopicExpr: string | RegExp;

    get name(): string {
        return this.options.name;
    }
    get topic(): string {
        return this.options.topic;
    }

    constructor(options: RouterOptions) {
        this.options = this.setOptions(options);
    }

    public getOptions(): RouterOptions {
        return this.options;
    }

    public setOptions(options: RouterOptions) {
        if (!options.name.match(new RegExp(NAME_MASK)))
            throw new Error(`Validation error: invalid name '${options.name}'`);
        if (!(options.copyTo && options.copyTo.length || options.moveTo && options.moveTo.length))
            throw new Error('Validation error: copyTo or moveTo is mandatory');

        this.options = options;

        for (const targets of [this.options.copyTo, this.options.moveTo])
            if (targets)
                if (Array.isArray(targets))
                    targets.sort();
        // this.inputTopicExpr = topicStrToRegexpOrString(options.inputTopic);
        return options;
    }

    public matchTopic(topic: string): boolean {
        // if (typeof this.inputTopicExpr === 'string') {
        //     if (this.inputTopicExpr.toLowerCase() === topic.toLowerCase())
        //         return true;
        // }
        // else if (this.inputTopicExpr instanceof RegExp) {
        //     if (this.inputTopicExpr.test(topic))
        //         return true;
        // }
        // return false;
        return this.options.topic.toLowerCase() === topic.toLowerCase();
    }

    public getOutputTopics(): {
        topics: string[],
        holdOriginal: boolean
    } {
        const result: string[] = [];
        for (const targets of [this.options.copyTo, this.options.moveTo])
            if (targets)
                if (Array.isArray(targets))
                    result.push(...targets)
                else
                    result.push(targets);

        return {
            topics: result,
            holdOriginal: this.options.copyTo && this.options.copyTo.length ? true : false,
        };
    }
}
