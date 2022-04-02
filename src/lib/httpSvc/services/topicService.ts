/* eslint-disable @typescript-eslint/no-magic-numbers */
import { prettyThousand } from '../../utility'

export default {

    getAllTopic() {
        const result = [];

        for (const topic of Context.Topics.getTopicsInfo()) {
            const subscribers = [];
            for (const bs of Context.ClientList)
                if (bs.matchSubscription(topic.topicName))
                    subscribers.push({
                        uniqueId: bs.getClientInfo().clientDetail.uniqueId,
                        clientId: bs.getClientInfo().clientDetail.clientId,
                    });
            subscribers.sort((a, b) => {
                let cmpresult = a.clientId.localeCompare(b.clientId);
                if (!cmpresult)
                    cmpresult = a.uniqueId - b.uniqueId;
                return cmpresult;
            });
            result.push({ ...topic, subscribers });
        }

        return result;
    },

    getTopic(topicname: string) {
        const topicinfo = Context.Topics.getTopicsInfo()
            .find((topic) => topic.topicName == topicname);

        if (topicinfo) {
            const subscribers = [];
            for (const bs of Context.ClientList)
                if (bs.matchSubscription(topicname))
                    subscribers.push({
                        uniqueId: bs.getClientInfo().clientDetail.uniqueId,
                        clientId: bs.getClientInfo().clientDetail.clientId,
                    });
            subscribers.sort((a, b) => {
                let cmpresult = a.clientId.localeCompare(b.clientId);
                if (!cmpresult)
                    cmpresult = a.uniqueId - b.uniqueId;
                return cmpresult;
            });
            const metrics = Context.Topics.getMetricByMinutes(topicname);
            return {
                ...topicinfo,
                subscribers,
                metrics: {
                    add:
                    {
                        1: metrics ? prettyThousand(metrics.add[1]) : 0,
                        5: metrics ? prettyThousand(metrics.add[5]) : 0,
                        15: metrics ? prettyThousand(metrics.add[15]) : 0,
                    },
                    remove:
                    {
                        1: metrics ? prettyThousand(metrics.remove[1]) : 0,
                        5: metrics ? prettyThousand(metrics.remove[5]) : 0,
                        15: metrics ? prettyThousand(metrics.remove[15]) : 0,
                    },
                }
            };
        }
        return;
    },

    clearTopic(topicname: string) {
        Context.MessageHandler.deleteTopicAllMessage(topicname);
    },

    getTopicMessage(topicname: string, messageid: string) {
        return Context.Topics.getMessage(topicname, messageid);
    },

    getTopicMessages(topicname: string, from: number, count: number) {
        const topicinfo = Context.Topics.getTopicsInfo()
            .find((topic) => topic.topicName == topicname);

        if (topicinfo) {
            const messages = Context.Topics.getTopicMessages(topicname, from, count);
            return {
                count: topicinfo.count,
                messages: messages.map((m) => {
                    return {
                        messageId: m.options.messageId,
                        priority: m.options.priority,
                        publishTime: m.publishTime,
                        publishTimeHuman: new Date(m.publishTime).toLocaleString(),
                        sourceClientId: m.sourceClientId,
                        body: JSON.stringify(m.message).slice(0, 64),
                    }
                }),
            };
        }
        return { count: 0, messages: [] }
    },

}
