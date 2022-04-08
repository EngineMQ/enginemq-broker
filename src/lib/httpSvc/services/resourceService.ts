import { ResourceType } from '../../ResourceHandler';
import { yamlJoin } from '../../utility';
import resourceServiceRouter from './resourceServiceRouter';

export type ResourceDisplay = {
    resourceType: ResourceType,
    resourceId: string,
    description: string,
    details: string[],
}
const RouterDisplaySorter = (a: ResourceDisplay, b: ResourceDisplay) => a.description.localeCompare(b.description);

export default {

    getAllResourcesByGroup(): {
        routers: ResourceDisplay[],
    } {
        const routers: ResourceDisplay[] = [];
        for (const [resourceId, router] of Context.ResourceHandler.getRouters().entries()) {

            const output = router.getOutputTopics();
            const details = output.topics.map((t) => `${router.topic} -> ${t}`);
            details.sort();
            if (output.holdOriginal)
                details.unshift('hold');
            else
                details.unshift('move');

            routers.push({
                resourceType: 'router',
                resourceId,
                description: router.description,
                details,
            });
        }
        routers.sort(RouterDisplaySorter);

        return { routers };
    },

    getAllResourceYaml(): string {
        const result: string[] = [];
        result.push(resourceServiceRouter.getAllRoutersYaml());
        return yamlJoin(result);
    },

    createFromYaml(yaml: Buffer) {
        Context.ResourceHandler.adaptFromYaml(yaml);
    },

    deleteAll() {
        Context.ResourceHandler.deleteAllResource();
    },

}
