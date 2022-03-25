export type RouterDisplay = {
    name: string,
    routes: { from: string, to: string }[],
    hold: boolean,
}


export default {

    getAllRouters(): RouterDisplay[] {
        const result = [];
        for (const router of Context.ResourceHandler
            .getRouters()
            .sort((a, b) => a.name.localeCompare(b.name))) {

            const routes = [];
            const output = router.getOutputTopics();
            for (const outputTopic of output.topics)
                routes.push({ from: router.topic, to: outputTopic });

            result.push({
                name: router.name,
                routes: routes,
                hold: output.holdOriginal,
            });
        }
        return result;
    },

    getRouter(name: string) {
        return Context.ResourceHandler
            .getRouters()
            .find((r) => r.name == name);
    }

    // removeAllLogs() {
    //     memoryLogStore.clear();
    // }
}
