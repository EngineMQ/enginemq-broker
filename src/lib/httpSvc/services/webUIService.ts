export default {

    getAllClients() {
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
                    topics: Context.Topics.getTopicsInfo()
                        .filter((topic) => bs.matchSubscription(topic.topic))
                        .map((topic) => topic.topic),
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
        for (let i = 0; i < Context.ClientList.length; i++) {
            const bs = Context.ClientList.getSocket(i);
            if (bs) {
                const cli = bs.getClientInfo();
                if (cli.clientDetail.uniqueId == uniqueId) {
                    return {
                        a: cli.address,
                    }
                }
            }
        }
        return null;
    },

}
