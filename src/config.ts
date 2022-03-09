import * as dotenv from 'dotenv';
import { get } from 'env-var';

dotenv.config();

const DEFAULT_PORT = 16677;
const DEFAULT_MAXWORKERS = 4;
const DEFAULT_MAXPACKETSIZEKB = 4;

export const isProduction = process.env['NODE_ENV'] === 'production';

export const serviceName = get('SERVICE_NAME').default('engine-mq-broker').asString();

export const logLevel = get('LOG_LEVEL').default('error').asString();

export const brokerPort = get('BROKER_PORT').default(DEFAULT_PORT).asPortNumber();
export const brokerHost = get('BROKER_HOST').default('127.0.0.1').asString();

export const heartbeatSec = get('HEARTBEAT_SEC').default(0).asInt();

export const minWorkers = 1;
export const maxWorkers = get('MAX_WORKERS').default(DEFAULT_MAXWORKERS).asInt();
export const maxPacketSizeBytes = get('MAX_PACKET_SIZE_KB').default(DEFAULT_MAXPACKETSIZEKB * 1024).asInt() * 1024;

export const uiPort = get('UI_PORT').default(0).asPortNumber();
export const uiHost = get('UI_HOST').default('127.0.0.1').asString();
