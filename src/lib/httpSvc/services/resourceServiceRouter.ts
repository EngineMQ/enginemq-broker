import { RouterOptions } from '../../resources/router/types';
import { yamlJoin } from '../../utility';

export type RouterMapInfo = {
    resourceId: string,
    description: string,
    routes: { from: string, to: string }[],
    hold: boolean,
}
const RouterDisplaySorter = (a: RouterMapInfo, b: RouterMapInfo) => a.description.localeCompare(b.description);

export default {

    getAllRoutersForMap(): RouterMapInfo[] {
        const result = [];
        for (const [resourceId, router] of Context.ResourceHandler.getRouters().entries()) {

            const routes = [];
            const output = router.getOutputTopics();
            for (const outputTopic of output.topics)
                routes.push({ from: router.topic, to: outputTopic });

            result.push({
                resourceId,
                description: router.description,
                routes: routes,
                hold: output.holdOriginal,
            });
        }
        result.sort(RouterDisplaySorter);
        return result;
    },
    getAllRoutersYaml(): string {
        const result: string[] = [];
        for (const [resourceId, router] of Context.ResourceHandler.getRouters().entries())
            result.push(router.getYaml(resourceId));
        return yamlJoin(result);
    },

    getRouter(resourceId: string) {
        return Context.ResourceHandler
            .getRouters()
            .get(resourceId);
    },

    insertOrUpdateRouter(resourceId: string, options: RouterOptions) {
        if (resourceId)
            Context.ResourceHandler.updateRouter(resourceId, options);
        else
            Context.ResourceHandler.addRouter(options);
    },

    deleteRouter(resourceId: string) {
        Context.ResourceHandler.deleteRouter(resourceId);
    },

    deleteAllRouter() {
        Context.ResourceHandler.deleteAllRouter();
    },

}
