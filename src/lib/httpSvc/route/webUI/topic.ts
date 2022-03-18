import { FastifyInstance } from "fastify";
import topicService from "../../services/topicService";

export default (server: FastifyInstance) => {
    server

        .get('/topic', async (_request, reply) => {
            const topics = topicService.getAllTopic();
            return reply.view("topicList", {
                title: "Topics",
                breadcrumb: [],
                topics,
            });
        })

        .get<{ Params: { topicname: string } }>('/topic/:topicname(^[a-zA-Z0-9.]+$)', async (request, reply) => {
            const topicName = request.params.topicname;
            const topic = topicService.getTopic(topicName);
            return reply.view("topic", {
                title: 'Topic',
                subtitle: topicName,
                breadcrumb: [{ url: '/topic', title: 'Topics' }],
                topicName,
                topic,
            });
        })

        .post<{ Body: { topicname: string } }>('/topic/clear', async (request, reply) => {
            topicService.clearTopic(request.body.topicname);
            return reply.send("OK");
        })
}
