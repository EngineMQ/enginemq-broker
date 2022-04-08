import * as yaml from 'js-yaml';

import logger from './logger';
import { IStorage, MessageStorageItem } from './storage/IStorage';
import { validateObject } from '../common/lib/ajv';
import { customAlphabet } from 'nanoid';

import { Router } from './resources/router/Router';
import { RouterOptions } from './resources/router/types';
import { tryParseYaml as tryParseRouterYaml } from './resources/router/yaml';

import { Validator } from './resources/validator/Validator';
import { ValidatorOptions } from './resources/validator/types';
import { tryParseYaml as tryParseValidatorYaml } from './resources/validator/yaml';

const log = logger.child({ module: 'Resources' });

const RESOURCE_ID_LENGTH = 20;
const genResourceId = () => customAlphabet('0123456789abcdef', RESOURCE_ID_LENGTH)();

export const resourceIdRegExp = `^[0-9a-f]{${RESOURCE_ID_LENGTH}}$`;

export type ResourceType = 'router' | 'validator';

export class ResourceHandler {
    private routers = new Map<string, Router>();
    private validators = new Map<string, Validator>();
    private storage: IStorage;

    constructor(storage: IStorage) {
        this.storage = storage;
        this.init();
    }




    // Public

    public adaptFromYaml(yamlData: Buffer) {
        if (yamlData.length === 0)
            throw new Error('Empty YAML data');

        let objs: object[] = [];
        try { objs = yaml.loadAll(yamlData.toString()) as object[]; }
        catch { throw new Error('Invalid YAML format'); }

        for (const routerData of tryParseRouterYaml(objs))
            try { Router.checkOptions(routerData.options); }
            catch (error) { throw new Error(`Yaml error in ${routerData.resourceId} ${error instanceof Error ? error.message : ''}`); }

        for (const routerData of tryParseValidatorYaml(objs))
            try { Validator.checkOptions(routerData.options); }
            catch (error) { throw new Error(`Yaml error in ${routerData.resourceId} ${error instanceof Error ? error.message : ''}`); }

        let resourceCount = 0;

        for (const routerData of tryParseRouterYaml(objs)) {
            resourceCount++;
            if (new RegExp(resourceIdRegExp).test(routerData.resourceId))
                if (this.routers.get(routerData.resourceId))
                    this.updateRouter(routerData.resourceId, routerData.options);
                else
                    this.addRouter(routerData.options, routerData.resourceId);
        }

        for (const validatorData of tryParseValidatorYaml(objs)) {
            resourceCount++;
            if (new RegExp(resourceIdRegExp).test(validatorData.resourceId))
                if (this.routers.get(validatorData.resourceId))
                    this.updateValidator(validatorData.resourceId, validatorData.options);
                else
                    this.addValidator(validatorData.options, validatorData.resourceId);
        }

        log.info({ count: resourceCount }, 'Resources adopted from yaml');
    }

    public deleteAllResource() {
        this.deleteAllRouter();
        this.deleteAllValidator();
        log.info('All resources deleted');
    }



    // Routers

    public runRouterChain(message: MessageStorageItem): string[] {
        const visitedTopics: string[] = [];
        const runRouter = (topic: string): string[] => {
            visitedTopics.push(topic);

            const result: string[] = [];

            const applicableRouters = [...this.routers.values()].filter((router) => router.matchTopic(topic));
            let removeTopic = applicableRouters.length > 0;

            for (const router of applicableRouters) {
                const output = router.getOutputTopics();
                if (output.holdOriginal)
                    removeTopic = false;
                for (const subTopic of output.topics) {
                    if (visitedTopics.includes(subTopic))
                        throw new Error(`Circular routing detected: from ${topic} to ${subTopic}`);
                    result.push(...runRouter(subTopic));
                }
            }

            if (!removeTopic)
                result.push(topic);
            return result;
        }
        return runRouter(message.topic).sort();
    }

    public getRouters() {
        return this.routers;
    }

    public addRouter(options: RouterOptions, resourceId?: string): string {
        if (!resourceId)
            resourceId = genResourceId();

        const router = new Router(options);
        this.routers.set(resourceId, router);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Router added');

        return resourceId;
    }

    public updateRouter(resourceId: string, options: RouterOptions) {
        const router = this.routers.get(resourceId);
        if (!router)
            throw new Error(`Router '${resourceId}' not found`);

        router.setOptions(options);
        this.storage.addOrUpdateResource('router', resourceId, JSON.stringify(router.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Router updated');
    }

    public deleteRouter(resourceId: string) {
        this.routers.delete(resourceId);
        this.storage.deleteResource('router', resourceId);

        log.info({ resourceId }, 'Router deleted');
    }

    public deleteAllRouter() {
        for (const resourceId of this.routers.keys()) {
            this.routers.delete(resourceId);
            this.storage.deleteResource('router', resourceId);
        }
        log.info('All routers deleted');
    }



    // Validators

    public checkValidation(message: MessageStorageItem, topicOverride?: string) {
        const applicableValidators = [...this.validators.values()].filter((validator) => validator.matchTopic(topicOverride || message.topic));
        for (const validator of applicableValidators) {
            const validationResult = validator.checkValidation(message.message);
            if (validationResult)
                throw new Error(`Validation error on topic ${message.topic} by rule ${validator.description}: ${validationResult}`);
        }
    }

    public getValidators() {
        return this.validators;
    }

    public addValidator(options: ValidatorOptions, resourceId?: string): string {
        if (!resourceId)
            resourceId = genResourceId();

        const validator = new Validator(options);
        this.validators.set(resourceId, validator);
        this.storage.addOrUpdateResource('validator', resourceId, JSON.stringify(validator.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Validator added');

        return resourceId;
    }

    public updateValidator(resourceId: string, options: ValidatorOptions) {
        const validator = this.validators.get(resourceId);
        if (!validator)
            throw new Error(`Validator '${resourceId}' not found`);

        validator.setOptions(options);
        this.storage.addOrUpdateResource('validator', resourceId, JSON.stringify(validator.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Validator updated');
    }

    public deleteValidator(resourceId: string) {
        this.validators.delete(resourceId);
        this.storage.deleteResource('validator', resourceId);

        log.info({ resourceId }, 'Validator deleted');
    }

    public deleteAllValidator() {
        for (const resourceId of this.validators.keys()) {
            this.validators.delete(resourceId);
            this.storage.deleteResource('validator', resourceId);
        }
        log.info('All validators deleted');
    }



    // Private

    private init() {
        for (const storageResource of this.storage.getResources('router')) {
            try {
                const optionsObject = validateObject<RouterOptions>(RouterOptions, JSON.parse(storageResource.optionjson), true);
                if (optionsObject) {
                    const router = new Router(optionsObject);
                    this.routers.set(storageResource.resourceId, router);
                    log.info({ resourceName: router.description }, 'Init router');
                }
            }
            catch (error) {
                log.error({ resourceName: storageResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init router failed');
            }
        }
        for (const storageResource of this.storage.getResources('validator')) {
            try {
                const optionsObject = validateObject<ValidatorOptions>(ValidatorOptions, JSON.parse(storageResource.optionjson), true);
                if (optionsObject) {
                    const validator = new Validator(optionsObject);
                    this.validators.set(storageResource.resourceId, validator);
                    log.info({ resourceName: validator.description }, 'Init validator');
                }
            }
            catch (error) {
                log.error({ resourceName: storageResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init validator failed');
            }
        }
    }

}