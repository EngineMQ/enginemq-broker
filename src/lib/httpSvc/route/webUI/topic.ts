import { FastifyInstance } from 'fastify';
//import { MESSAGE_ID_MASK, TOPIC_MASK } from '../../../../common/messageTypes';
import topicService from '../../services/topicService';
import pager from '../../utils/pager';

const HTTP_NOT_FOUND = 404;
//const TOPIC_MASK_STR = TOPIC_MASK.source;
const TOPIC_MASK_STR = '^[a-z0-9.]+$';
//const MESSAGE_ID_MASK_EX_STR = MESSAGE_ID_MASK.replace('$', '(-[0-9]+)?$');
const MESSAGE_ID_MASK_EX_STR = '^[a-z0-9-.]+$';

export default (server: FastifyInstance) => {
    server.protectRoute('/topic');
    server

        .get('/topics', async (_request, reply) => {
            const topics = topicService.getAllTopic();
            return reply.view('topicList', {
                title: 'Topics',
                breadcrumb: [],
                topics,
            });
        })

        .get<{ Params: { topicname: string } }>(`/topic/:topicname(${TOPIC_MASK_STR})`, async (request, reply) => {
            const topicName = request.params.topicname;
            const topic = topicService.getTopic(topicName);
            return reply.view('topic', {
                title: 'Topic',
                subtitle: topicName,
                breadcrumb: [{ url: '/topics', title: 'Topics' }],
                topicName,
                topic,
            });
        })

        .post<{ Body: { topicname: string } }>('/topic/clear', async (request, reply) => {
            topicService.clearTopic(request.body.topicname);
            return reply.send('OK');
        })

        .get<{ Params: { topicname: string }, Querystring: { page?: number } }>(`/topic/:topicname(${TOPIC_MASK_STR})/messages`, async (request, reply) => {
            const MESSAGES_PER_PAGE = 25;

            const topicName = request.params.topicname;
            const currentPage = Math.max(request.query.page || 1, 0);

            const messages = topicService.getTopicMessages(topicName, (currentPage - 1) * MESSAGES_PER_PAGE, MESSAGES_PER_PAGE);
            const messageCount = messages.count;
            const pages = pager(messageCount, MESSAGES_PER_PAGE, currentPage);

            return reply.view('topicMessageList', {
                title: 'Topic messages',
                subtitle: `${messageCount || 'No'} messages in ${topicName}`,
                breadcrumb: [
                    { url: '/topics', title: 'Topics' },
                    { url: `/topic/${topicName}`, title: topicName }],
                topicName,
                messages,
                pages,
                currentPage,
            });
        })

        .get<{ Params: { topicname: string, messageid: string } }>(`/topic/:topicname(${TOPIC_MASK_STR})/message/:messageid(${MESSAGE_ID_MASK_EX_STR})/messagebody`, async (request, reply) => {
            const topicName = request.params.topicname;
            const messageid = request.params.messageid;
            const message = topicService.getTopicMessage(topicName, messageid);

            if (message) {
                const messagestr = JSON.stringify(message.message, undefined, 2);
                return reply.send(messagestr);
            }
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find message ${messageid} on topic ${topicName}`);
        })

}
