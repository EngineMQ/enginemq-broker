import * as dotenv from 'dotenv';
import { get } from 'env-var';

dotenv.config();

const DEFAULT_BROKER_PORT = 16677;
const DEFAULT_HTTP_PORT = 16688;
const DEFAULT_HOST = '0.0.0.0';

const DEFAULT_MAXWORKERS = 4;
const DEFAULT_MAXPACKETSIZEKB = 4;

export const isProduction = process.env['NODE_ENV'] === 'production';

export const serviceName = get('SERVICE_NAME').default('engine-mq-broker').asString();

export const logLevel = get('LOG_LEVEL').default('error').asString();

export const brokerPort = get('BROKER_PORT').default(DEFAULT_BROKER_PORT).asPortNumber();
export const brokerHost = get('BROKER_HOST').default(DEFAULT_HOST).asString();

export const heartbeatSec = get('HEARTBEAT_SEC').default(0).asInt();

export const minWorkers = 1;
export const maxWorkers = get('MAX_WORKERS').default(DEFAULT_MAXWORKERS).asInt();
export const maxPacketSizeBytes = get('MAX_PACKET_SIZE_KB').default(DEFAULT_MAXPACKETSIZEKB * 1024).asInt() * 1024;

export const uiPort = get('HTTP_PORT').default(DEFAULT_HTTP_PORT).asPortNumber();
export const uiHost = get('HTTP_HOST').default(DEFAULT_HOST).asString();

export const apiEnabled = get('API_ENABLED').default('true').asBool();
export const webUIEnabled = get('WEBUI_ENABLED').default('true').asBool();
