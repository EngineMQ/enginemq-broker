import { IResource } from '../IResource';
import { RouterOptions, validateOptions } from './types';
import { getLatestYaml } from './yaml';
// import { topicStrToRegexpOrString } from "../utility";

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

    public setOptions(options: RouterOptions): RouterOptions {
        validateOptions(options);

        this.options = options;

        for (const targets of [this.options.copyTo, this.options.moveTo])
            if (targets && Array.isArray(targets))
                targets.sort();
        // this.inputTopicExpr = topicStrToRegexpOrString(options.inputTopic);
        return options;
    }

    public getYaml(resourceId: string): string {
        return getLatestYaml(resourceId, this.options);
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
            holdOriginal: this.options.copyTo && this.options.copyTo.length > 0 ? true : false,
        };
    }
}
