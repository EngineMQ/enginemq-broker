import { RouterOptions } from "../../resources/Router";

export type RouterDisplay = {
    resourceId: string,
    name: string,
    routes: { from: string, to: string }[],
    hold: boolean,
}


export default {

    getAllRouters(): RouterDisplay[] {
        const result = [];
        for (const [resourceId, router] of Context.ResourceHandler.getRouters().entries()) {

            const routes = [];
            const output = router.getOutputTopics();
            for (const outputTopic of output.topics)
                routes.push({ from: router.topic, to: outputTopic });

            result.push({
                resourceId,
                name: router.name,
                routes: routes,
                hold: output.holdOriginal,
            });
        }
        return result;
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

}
