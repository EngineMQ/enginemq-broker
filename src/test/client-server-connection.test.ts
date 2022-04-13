/* eslint-disable @typescript-eslint/no-magic-numbers */

//process.env['LOG_LEVEL'] = 'debug';

import * as enginemq from 'enginemq-client';

import { createBroker, closeBroker } from '../lib/broker';
import { createHttpserver, closeHttpserver } from '../lib/http';

describe('client-server connection', () => {
    describe.each<string>([
        'null()',
        'fs(folder=../storage)',
        'sqlite3(file=../sqlite3/enginemq-broker.sqlite3)',
    ])('engine: %s', (storageEngine: string) => {

        beforeAll(async () => {
            await createBroker(storageEngine)
                .then(async ({ clientList, messageHandler, topics, storage, resourceHandler }) => {
                    global.Context = {
                        ClientList: clientList,
                        MessageHandler: messageHandler,
                        Topics: topics,
                        Storage: storage,
                        ResourceHandler: resourceHandler,
                    };
                    messageHandler.deleteAllMessage();
                    resourceHandler.deleteAllRouter();
                    resourceHandler.deleteAllValidator();
                    resourceHandler.deleteAllAuth();
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

        test('connect and disconnect', async () => {
            expect.assertions(4);

            const client = new enginemq.EngineMqClient({ clientId: 'test-client', connectAutoStart: false });

            const mqConnected = jest.fn();
            client.on('mq-connected', mqConnected);

            const mqReady = jest.fn();
            client.on('mq-ready', () => {
                mqReady();
            });

            const mqDisconnected = jest.fn();
            client.on('mq-disconnected', mqDisconnected);

            client.connect();

            await new Promise((d) => setTimeout(d, 250));
            expect(mqConnected).toBeCalled();
            expect(mqReady).toBeCalled();
            expect(global.Context.ClientList).toHaveLength(1);

            client.close();

            await new Promise((d) => setTimeout(d, 250));
            expect(mqDisconnected).toBeCalled();
        });

        const MESSAGE_COUNT = Math.round(Math.random() * 100) + 1;
        test(`publish ${MESSAGE_COUNT} messages`, async () => {
            expect.assertions(1);

            const client = new enginemq.EngineMqClient({ clientId: 'test-client', connectAutoStart: false });

            client.on('mq-ready', async () => {
                for (let index = 0; index < MESSAGE_COUNT; index++)
                    await client.publish(
                        'log.analitics.wordpress',
                        { str: 'Example data' });
            });

            client.connect();
            await new Promise((d) => setTimeout(d, 1000));

            expect(global.Context.MessageHandler).toHaveLength(MESSAGE_COUNT);

            client.close();
        });

        test('try publish invalid messageid', async () => {
            expect.assertions(1);

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
    }, 10 * 1000);
});
