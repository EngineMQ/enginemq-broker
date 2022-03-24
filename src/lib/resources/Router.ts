import { IResource } from "./IResource";
// import { topicStrToRegexpOrString } from "../utility";
import { Static, Type } from "@sinclair/typebox";

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
    private usage = 0;
    private options: RouterOptions;
    // private inputTopicExpr: string | RegExp;

    get name(): string {
        return this.options.name;
    }
    public getUsage(): number {
        return this.usage;
    }

    constructor(options: RouterOptions) {
        this.options = options;
        if (!this.options.copyTo && !this.options.moveTo)
            throw new Error('Validation error: copyTo or moveTo is mandatory');
        // this.inputTopicExpr = topicStrToRegexpOrString(options.inputTopic);
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
        this.usage++;

        const result: string[] = [];
        for (const targets of [this.options.copyTo, this.options.moveTo])
            if (targets)
                if (Array.isArray(targets))
                    result.push(...targets)
                else
                    result.push(targets);

        return {
            topics: result,
            holdOriginal: this.options.copyTo ? true : false,
        };
    }
}
