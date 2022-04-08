import { ResourceType } from '../../ResourceHandler';

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

    createFromYaml(yaml: Buffer) {
        Context.ResourceHandler.adaptRoutersFromYaml(yaml);
    },

}
