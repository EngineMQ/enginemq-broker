export default {

    getAllClients() {
        const topicsInfo = Context.Topics.getAllTopics();
        const result = [];
        for (let i = 0; i < Context.ClientList.length; i++) {
            const bs = Context.ClientList.getSocket(i);
            if (bs) {
                const cli = bs.getClientInfo();
                result.push({
                    uniqueId: cli.clientDetail.uniqueId,
                    clientId: cli.clientDetail.clientId,
                    info: cli.clientDetail,
                    address: cli.address,
                    stat: cli.stat,
                    topics: topicsInfo.filter((topic) => bs.matchSubscription(topic))
                });
            }
        }
        result.sort((a, b) => {
            let sortinfo = a.clientId.localeCompare(b.clientId);
            if (!sortinfo)
                sortinfo = a.uniqueId - b.uniqueId;
            return sortinfo;
        })
        return result;
    },

    getClient(uniqueId: number) {
        const topicsInfo = Context.Topics.getAllTopics();
        for (let i = 0; i < Context.ClientList.length; i++) {
            const bs = Context.ClientList.getSocket(i);
            if (bs) {
                const cli = bs.getClientInfo();
                if (cli.clientDetail.uniqueId == uniqueId)
                    return {
                        uniqueId: cli.clientDetail.uniqueId,
                        clientId: cli.clientDetail.clientId,
                        info: cli.clientDetail,
                        addressDetail: cli.addressDetail,
                        stat: cli.stat,
                        topics: topicsInfo.filter((topic) => bs.matchSubscription(topic)),
                        subscriptions: Array
                            .from(cli.subscriptions)
                            .map((item) => item.toString())
                            .sort((a: string, b: string) => a.localeCompare(b)),
                    }
            }
            continue;
        }
        return null;
    },

    kickClient(uniqueId: number) {
        Context.ClientList.destroy(uniqueId);
    }
}
