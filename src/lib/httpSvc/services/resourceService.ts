import { ResourceType } from '../../ResourceHandler';
import { yamlJoin } from '../../utility';
import resourceServiceRouter from './resourceServiceRouter';
import resourceServiceValidator from './resourceServiceValidator';

export type ResourceDisplay = {
    resourceType: ResourceType,
    resourceId: string,
    description: string,
    details: string[],
    badges?: { text: string, style: string }[],
}
const RouterDisplaySorter = (a: ResourceDisplay, b: ResourceDisplay) => a.description.localeCompare(b.description);

export default {

    getAllResourcesByGroup(): {
        routers: ResourceDisplay[],
        validators: ResourceDisplay[],
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
        routers.sort(RouterDisplaySorter);

        const validators: ResourceDisplay[] = [];
        for (const [resourceId, validator] of Context.ResourceHandler.getValidators().entries())
            validators.push({
                resourceType: 'validator',
                resourceId,
                description: validator.description,
                details: validator.topics.sort(),
            });
        validators.sort(RouterDisplaySorter);

        return {
            routers,
            validators,
        };
    },

    getAllResourceYaml(): string {
        const result: string[] = [];
        result.push(
            resourceServiceRouter.getAllRoutersYaml(),
            resourceServiceValidator.getAllValidatorsYaml(),
        );
        return yamlJoin(result);
    },

    createFromYaml(yaml: Buffer) {
        Context.ResourceHandler.adaptFromYaml(yaml);
    },

    deleteAll() {
        Context.ResourceHandler.deleteAllResource();
    },

}
