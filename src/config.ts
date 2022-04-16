import * as dotenv from 'dotenv';
import { get } from 'env-var';

if (process.env['NODE_ENV'] != 'test')
    dotenv.config();

const DEFAULT_SERVICE_NAME = 'enginemq-broker';
const DEFAULT_LOG_LEVEL = 'warn';

const DEFAULT_BROKER_PORT = 16_677;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_STORAGE = 'fs(folder=../storage)';
const DEFAULT_MAXCLIENTWORKERS = 4;
const DEFAULT_MAXPACKETSIZEKB = 1024;

const DEFAULT_HTTP_PORT = 16_688;

//--System--
export const isProduction = process.env['NODE_ENV'] === 'production';
export const serviceName = get('SERVICE_NAME').default(DEFAULT_SERVICE_NAME).asString();
export const logLevel = get('LOG_LEVEL').default(DEFAULT_LOG_LEVEL).asString();

//--Broker--
export const brokerPort = get('BROKER_PORT').default(DEFAULT_BROKER_PORT).asPortNumber();
export const brokerHost = get('BROKER_HOST').default(DEFAULT_HOST).asString();
export const storage = get('STORAGE').default(DEFAULT_STORAGE).asString();
export const heartbeatSec = get('HEARTBEAT_SEC').default(0).asInt();
export const minWorkers = 1;
export const maxClientWorkers = get('MAX_CLIENT_WORKERS').default(DEFAULT_MAXCLIENTWORKERS).asInt();
export const maxPacketSizeBytes = get('MAX_PACKET_SIZE_KB').default(DEFAULT_MAXPACKETSIZEKB).asInt() * 1024;
export const resourceOrigin = get('RESOURCE_ORIGIN').default('').asString();

//--WebUI+API--
export const uiPort = get('HTTP_PORT').default(DEFAULT_HTTP_PORT).asPortNumber();
export const uiHost = get('HTTP_HOST').default(DEFAULT_HOST).asString();
export const apiEnabled = get('API_ENABLED').default('true').asBool();
export const webUIEnabled = get('WEBUI_ENABLED').default('true').asBool();

if (isProduction)
    Error.stackTraceLimit = 0;
