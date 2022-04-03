/* eslint-disable @typescript-eslint/no-magic-numbers */
import * as enginemq from 'enginemq-client';
import { version } from '../../package.json'

import { createBroker, closeBroker } from '../lib/broker';
import { createHttpserver, closeHttpserver } from '../lib/http';

describe('client', () => {

    beforeAll(async () => {
        await createBroker()
            .then(async ({ clientList, messageHandler, topics, storage, resourceHandler }) => {
                global.Context = {
                    ClientList: clientList,
                    MessageHandler: messageHandler,
                    Topics: topics,
                    Storage: storage,
                    ResourceHandler: resourceHandler,
                };
                return createHttpserver()
            })
    })
    afterAll(async () => {
        await closeHttpserver();
        await closeBroker();
    })

    test('create client', () => {
        new enginemq.EngineMqClient({ clientId: 'test-client', connectAutoStart: false });
    });

    test('connect client', async () => {
        const client = new enginemq.EngineMqClient({ clientId: 'test-client', connectAutoStart: false });

        const mqConnected = jest.fn();
        client.on('mq-connected', mqConnected);

        const mqReady = jest.fn();
        client.on('mq-ready', (serverVersion, heartbeatSec) => {
            mqReady();
            expect(serverVersion).toEqual(version);
            expect(heartbeatSec).toEqual(10);
        });

        const mqDisconnected = jest.fn();
        client.on('mq-disconnected', mqDisconnected);

        client.connect();

        await new Promise((d) => setTimeout(d, 250));
        expect(mqConnected).toBeCalled();
        expect(mqReady).toBeCalled();

        client.close();

        await new Promise((d) => setTimeout(d, 250));
        expect(mqDisconnected).toBeCalled();
    });

    test('publish', async () => {
        const client = new enginemq.EngineMqClient({ clientId: 'test-client', connectAutoStart: false });

        client.on('mq-ready', async () => {
            await client.publish(
                'log.analitics.wordpress',
                { str: 'Example data' });
        });

        client.connect();
        await new Promise((d) => setTimeout(d, 250));

        client.close();
    });

    test('publish invalid messageid', async () => {
        const client = new enginemq.EngineMqClient({ clientId: 'test-client', connectAutoStart: false });

        client.on('mq-ready', async () => {
            await expect(async () => {
                await client.publish(
                    'log.analitics.wordpress',
                    { str: 'Example data' },
                    { messageId: 'INVALID_MESSAGE_ID' });
            }).rejects.toThrow('EngineMQ publish invalid messageId format: INVALID_MESSAGE_ID')
        });

        client.connect();
        await new Promise((d) => setTimeout(d, 250));

        client.close();
    });

});
