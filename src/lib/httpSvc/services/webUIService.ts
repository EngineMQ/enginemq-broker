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
                    subscriptions: cli.subscriptions,
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
    }

}
