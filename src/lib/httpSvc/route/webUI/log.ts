import { FastifyInstance } from 'fastify';
import { MEMORYLOG_MAX_ITEMS } from '../../../logger';
import logService from '../../services/logService';

export default (server: FastifyInstance) => {
    server.protectRoute('/logs');
    server

        .get('/logs', async (_request, reply) => {
            const logs = logService.getAllLogs();
            const firstLevel = Object.keys(logs.levels).length > 0 ? Object.keys(logs.levels)[0] : '';
            return reply.view('logList', {
                title: 'Logs',
                subtitle: `Last ${MEMORYLOG_MAX_ITEMS}`,
                breadcrumb: [],
                firstLevel,
                levels: logs.levels,
                levellines: logs.lines,
            });
        })

        .post('/logs/clear', async (_request, reply) => {
            logService.removeAllLogs();
            return reply.send('OK');
        })

}
