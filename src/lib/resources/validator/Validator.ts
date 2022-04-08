import { ValidateFunction } from 'ajv';
import { IResource } from '../IResource';
import { ValidatorOptions, validateOptions, CreateAjvValidator } from './types';
import { getLatestYaml } from './yaml';
// import { topicStrToRegexpOrString } from "../utility";

export class Validator implements IResource {
    private options: ValidatorOptions;
    private validateFunction: ValidateFunction<unknown>;
    // private inputTopicExpr: string | RegExp;

    get description(): string {
        return this.options.description;
    }

    get topics(): string[] {
        return Array.isArray(this.options.topics) ? this.options.topics : [this.options.topics || ''];
    }

    constructor(options: ValidatorOptions) {
        this.options = this.setOptions(options);
        this.validateFunction = CreateAjvValidator().compile(options.schema);
    }

    public getOptions(): ValidatorOptions {
        return this.options;
    }

    public static checkOptions(options: ValidatorOptions): void { validateOptions(options); }

    public setOptions(options: ValidatorOptions): ValidatorOptions {
        validateOptions(options);

        this.options = options;

        if (options.topics && Array.isArray(options.topics))
            options.topics.sort();
        // this.inputTopicExpr = topicStrToRegexpOrString(options.inputTopic);

        this.validateFunction = CreateAjvValidator().compile(options.schema);

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
        return Array.isArray(this.options.topics)
            ?
            this.options.topics.includes(topic)
            :
            this.options.topics.toLowerCase() === topic.toLowerCase();
    }

    public checkValidation(object: object): string | undefined {
        if (this.validateFunction(object))
            return;

        let messageString = 'Validation error';
        if (this.validateFunction.errors && this.validateFunction.errors[0]) {
            const path = this.validateFunction.errors[0].instancePath;
            const message = this.validateFunction.errors[0].message || '';
            messageString = `${path} ${message}`;
        }
        return messageString;
    }
}
