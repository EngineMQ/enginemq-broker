import { ILoginHandler, ResourceType } from '../../ResourceHandler';
import { IResourceOriginLastStatus } from '../../resourceOrigins/IResourceOrigin';
import { yamlJoin } from '../../utility';
import resourceServiceAuth from './resourceServiceAuth';
import resourceServiceRouter from './resourceServiceRouter';
import resourceServiceValidator from './resourceServiceValidator';

export type ResourceDisplay = {
    resourceType: ResourceType,
    resourceId: string,
    description: string,
    details?: string[],
    badges?: { text: string, style: string }[],
}
const ResourceDisplaySorter = (a: ResourceDisplay, b: ResourceDisplay) => a.description.localeCompare(b.description);

export default {

    getAllResourcesByGroup(): {
        routers: ResourceDisplay[],
        validators: ResourceDisplay[],
        auths: ResourceDisplay[],
    } {
        const routers: ResourceDisplay[] = [];
        for (const [resourceId, router] of Context.ResourceHandler.getRouters().entries()) {

            const output = router.getOutputTopics();
            const details = output.topics.map((t) => `${router.topic} -> ${t}`);

            routers.push({
                resourceType: 'router',
                resourceId,
                description: router.description,
                details: details.sort(),
                badges: output.holdOriginal ? [{ text: 'hold', style: 'success' }] : [{ text: 'move', style: 'warning' }],
            });
        }
        routers.sort(ResourceDisplaySorter);

        const validators: ResourceDisplay[] = [];
        for (const [resourceId, validator] of Context.ResourceHandler.getValidators().entries())
            validators.push({
                resourceType: 'validator',
                resourceId,
                description: validator.description,
                details: validator.topics.sort(),
            });
        validators.sort(ResourceDisplaySorter);

        const auths: ResourceDisplay[] = [];
        for (const [resourceId, auth] of Context.ResourceHandler.getAuths().entries()) {

            const topicsCount = auth.getTopicsCount();

            auths.push({
                resourceType: 'auth',
                resourceId,
                description: auth.description,
                details: [
                    `${topicsCount.subscribeTo || 'No'} subscribe permissions`,
                    `${topicsCount.publishTo || 'No'} publish permissions`,
                    '',
                    auth.maskedToken,
                ],
                badges: auth.webAccess ? [{ text: 'Web access', style: 'primary' }] : [],
            });
        }
        auths.sort(ResourceDisplaySorter);

        return {
            routers,
            validators,
            auths,
        };
    },

    getAllResourceYaml(): string {
        const result: string[] = [];
        result.push(
            resourceServiceRouter.getAllRoutersYaml(),
            resourceServiceValidator.getAllValidatorsYaml(),
            resourceServiceAuth.getAllAuthYaml(),
        );
        return yamlJoin(result);
    },

    createFromYaml(yaml: Buffer) {
        Context.ResourceHandler.adaptFromYaml(yaml);
    },

    deleteAll() {
        Context.ResourceHandler.deleteAllResource();
    },

    getAuthInfo() {
        const auths = Context.ResourceHandler as ILoginHandler;
        return {
            isAnonymousMode: auths.isAnonymousMode(),
            isAnonymousWebUiMode: auths.isAnonymousWebUiMode(),
        }
    },

    getResourceOriginLastStatus(): IResourceOriginLastStatus | undefined {
        if (Context.ResourceOriginHandler)
            return Context.ResourceOriginHandler.getLastStatus();
        return;
    }

}
