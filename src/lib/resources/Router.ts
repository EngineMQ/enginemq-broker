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
    private options: RouterOptions;
    // private inputTopicExpr: string | RegExp;

    get name(): string {
        return this.options.name;
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
        copyTo: string[],
        moveTo: string[]
    } {
        return {
            copyTo:
                this.options.copyTo ?
                    Array.isArray(this.options.copyTo) ?
                        this.options.copyTo :
                        [this.options.copyTo] :
                    [],
            moveTo:
                this.options.moveTo ?
                    Array.isArray(this.options.moveTo) ?
                        this.options.moveTo :
                        [this.options.moveTo] :
                    [],
        };
    }
}
