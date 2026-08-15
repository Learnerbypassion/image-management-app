import Redis from 'ioredis';
import env from './env.js';
import logger from '../utils/logger.js';

export const redisConnectionOptions = env.REDIS_URL
  ? { url: env.REDIS_URL, maxRetriesPerRequest: null }
  : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        // Reconnect after delay, max 10000ms
        return Math.min(times * 500, 10000);
      },
    };

let redisClient = null;

export const getRedisClient = () => {
  if (!redisClient) {
    if (env.REDIS_URL) {
      redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    } else {
      redisClient = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 500, 10000),
      });
    }

    redisClient.on('connect', () => {
      logger.info('Connected to Redis server.');
    });

    redisClient.on('error', (err) => {
      // Suppress spammy offline connection warnings
    });
  }

  return redisClient;
};

export const checkRedisHealth = async () => {
  try {
    const client = getRedisClient();
    const ping = await client.ping();
    return ping === 'PONG';
  } catch (err) {
    return false;
  }
};

export default {
  redisConnectionOptions,
  getRedisClient,
  checkRedisHealth,
};
