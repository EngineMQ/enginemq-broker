import { FastifyInstance } from 'fastify';
import topicService from '../../services/topicService';
import pager from '../../utils/pager';

const HTTP_NOT_FOUND = 404;

export default (server: FastifyInstance) => {
    server

        .get('/topics', async (_request, reply) => {
            const topics = topicService.getAllTopic();
            return reply.view('topicList', {
                title: 'Topics',
                breadcrumb: [],
                topics,
            });
        })

        .get<{ Params: { topicname: string } }>('/topic/:topicname(^[a-zA-Z0-9.]+$)', async (request, reply) => {
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

        .get<{ Params: { topicname: string }, Querystring: { page?: number } }>('/topic/:topicname(^[a-zA-Z0-9.]+$)/messages', async (request, reply) => {
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

        .get<{ Params: { topicname: string, messageid: string } }>('/topic/:topicname(^[a-zA-Z0-9.]+$)/message/:messageid(^[a-zA-Z0-9.]+$)/messagebody', async (request, reply) => {
            const topicName = request.params.topicname;
            const messageid = request.params.messageid;
            const message = topicService.getTopicMessage(topicName, messageid);

            if (message) {
                const messagestr = JSON.stringify(message.message, null, 2);
                return reply.send(messagestr);
            }
            return reply.code(HTTP_NOT_FOUND).send(`Cannot find message ${messageid} on topic ${topicName}`);
        })

}
