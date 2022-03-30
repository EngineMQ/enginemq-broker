import { Static, Type } from "@sinclair/typebox";
import * as yaml from 'js-yaml';
import { TOPIC_LENGTH_MAX, TOPIC_MASK } from "../../common/messageTypes";
import { trimStringFields } from "../utility";
import { IResource } from "./IResource";
// import { topicStrToRegexpOrString } from "../utility";

const DESCRIPTION_LENGTH_MAX = 50;

export type RouterOptions = Static<typeof RouterOptions>;
export const RouterOptions = Type.Object({
    description: Type.String(),
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

    get description(): string {
        return this.options.description;
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
        trimStringFields(options);

        if (!options.description)
            throw new Error(`Validation error: description mandatory`);
        if (options.description.length > DESCRIPTION_LENGTH_MAX)
            throw new Error(`Validation error: description too long'${options.description}'`);

        if (!options.topic)
            throw new Error(`Validation error: topic mandatory`);
        if (!options.topic.match(TOPIC_MASK))
            throw new Error(`Validation error: invalid topic format`);
        if (options.topic.length > TOPIC_LENGTH_MAX)
            throw new Error(`Validation error: topic too long`);

        if (!(options.copyTo && options.copyTo.length || options.moveTo && options.moveTo.length))
            throw new Error('Validation error: copyTo or moveTo is mandatory');

        for (const targets of [options.copyTo, options.moveTo])
            if (targets)
                if (Array.isArray(targets)) {
                    for (const target of targets)
                        if (!target.match(TOPIC_MASK))
                            throw new Error(`Validation error: invalid topic format ${target}`);
                }
                else if (!targets.match(TOPIC_MASK))
                    throw new Error(`Validation error: invalid topic format ${targets}`);

        this.options = options;

        for (const targets of [this.options.copyTo, this.options.moveTo])
            if (targets)
                if (Array.isArray(targets))
                    targets.sort();
        // this.inputTopicExpr = topicStrToRegexpOrString(options.inputTopic);
        return options;
    }

    public getYaml(resourceId: string): string {
        const yamlObj = {
            kind: 'router',
            api: 'v1',
            meta: {
                id: resourceId,
            },
            spec: this.options
        }
        return yaml.dump(yamlObj);
    }

    public setupFromYaml() {

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
