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

import { Auth } from './resources/auth/Auth';
import { AuthOptions } from './resources/auth/types';
import { tryParseYaml as tryParseAuthYaml } from './resources/auth/yaml';

const log = logger.child({ module: 'Resources' });

const RESOURCE_ID_LENGTH = 20;
const genResourceId = () => customAlphabet('0123456789abcdef', RESOURCE_ID_LENGTH)();

export const resourceIdRegExp = `^[0-9a-f]{${RESOURCE_ID_LENGTH}}$`;

export type ResourceType = 'router' | 'validator' | 'auth';

export interface ILoginHandler {
    isAnonymousMode(): boolean;
    getAuthByToken(token: string): Auth | undefined;
}

export class ResourceHandler implements ILoginHandler {
    private routers = new Map<string, Router>();
    private validators = new Map<string, Validator>();
    private auths = new Map<string, Auth>();
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
            catch (error) { throw new Error(`Yaml error in router ${routerData.resourceId} ${error instanceof Error ? error.message : ''}`); }

        for (const validatorData of tryParseValidatorYaml(objs))
            try { Validator.checkOptions(validatorData.options); }
            catch (error) { throw new Error(`Yaml error in validator ${validatorData.resourceId} ${error instanceof Error ? error.message : ''}`); }

        for (const authData of tryParseAuthYaml(objs))
            try { Auth.checkOptions(authData.options); }
            catch (error) { throw new Error(`Yaml error in auth ${authData.resourceId} ${error instanceof Error ? error.message : ''}`); }

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

        for (const authData of tryParseAuthYaml(objs)) {
            resourceCount++;
            if (new RegExp(resourceIdRegExp).test(authData.resourceId))
                if (this.routers.get(authData.resourceId))
                    this.updateAuth(authData.resourceId, authData.options);
                else
                    this.addAuth(authData.options, authData.resourceId);
        }

        log.info({ count: resourceCount }, 'Resources adopted from yaml');
    }

    public deleteAllResource() {
        this.deleteAllRouter();
        this.deleteAllValidator();
        this.deleteAllAuth();
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



    // Auths

    public generateNewUniqueToken(): string {
        let result;
        while (!result || this.getAuthByToken(result))
            result = Auth.generateNewToken();
        return result;
    }

    public isAnonymousMode(): boolean { return this.auths.size === 0; }

    public getAuthByToken(token: string): Auth | undefined {
        for (const auth of this.auths.values())
            if (auth.token === token)
                return auth;
        return;
    }

    public checkTokenAlreadyUsed(token: string, resourceId: string): boolean {
        for (const [id, auth] of this.auths.entries())
            if (auth.token === token && id != resourceId)
                return true;
        return false;
    }

    public getAuths() {
        return this.auths;
    }

    public addAuth(options: AuthOptions, resourceId?: string): string {
        if (!resourceId)
            resourceId = genResourceId();

        const auth = new Auth(options);
        this.auths.set(resourceId, auth);
        this.storage.addOrUpdateResource('auth', resourceId, JSON.stringify(auth.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Auth added');

        return resourceId;
    }

    public updateAuth(resourceId: string, options: AuthOptions) {
        const auth = this.auths.get(resourceId);
        if (!auth)
            throw new Error(`Auth '${resourceId}' not found`);

        if (this.checkTokenAlreadyUsed(options.token, resourceId))
            throw new Error('Validation error: token already used');
        auth.setOptions(options);
        this.storage.addOrUpdateResource('auth', resourceId, JSON.stringify(auth.getOptions(), undefined, 2));

        log.info({ resourceId, options }, 'Auth updated');
    }

    public deleteAuth(resourceId: string) {
        this.auths.delete(resourceId);
        this.storage.deleteResource('auth', resourceId);

        log.info({ resourceId }, 'Auth deleted');
    }

    public deleteAllAuth() {
        for (const resourceId of this.auths.keys()) {
            this.auths.delete(resourceId);
            this.storage.deleteResource('auth', resourceId);
        }
        log.info('All auths deleted');
    }



    // Private

    private init() {

        for (const routerResource of this.storage.getResources('router')) {
            try {
                const optionsObject = validateObject<RouterOptions>(RouterOptions, JSON.parse(routerResource.optionjson), true);
                if (optionsObject) {
                    const router = new Router(optionsObject);
                    this.routers.set(routerResource.resourceId, router);
                    log.info({ resourceName: router.description }, 'Init router');
                }
            }
            catch (error) {
                log.error({ resourceName: routerResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init router failed');
            }
        }

        for (const validatorResource of this.storage.getResources('validator')) {
            try {
                const optionsObject = validateObject<ValidatorOptions>(ValidatorOptions, JSON.parse(validatorResource.optionjson), true);
                if (optionsObject) {
                    const validator = new Validator(optionsObject);
                    this.validators.set(validatorResource.resourceId, validator);
                    log.info({ resourceName: validator.description }, 'Init validator');
                }
            }
            catch (error) {
                log.error({ resourceName: validatorResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init validator failed');
            }
        }

        for (const authResource of this.storage.getResources('auth')) {
            try {
                const optionsObject = validateObject<AuthOptions>(AuthOptions, JSON.parse(authResource.optionjson), true);
                if (optionsObject) {
                    const auth = new Auth(optionsObject);
                    this.auths.set(authResource.resourceId, auth);
                    log.info({ resourceName: auth.description }, 'Init auth');
                }
            }
            catch (error) {
                log.error({ resourceName: authResource.resourceId, error: error instanceof Error ? error.message : '' }, 'Init auth failed');
            }
        }
    }

}