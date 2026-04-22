import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  logger.error('Redis', 'Erro de conexão', err);
});

redisConnection.on('connect', () => {
  logger.success('Redis', 'Conectado ao Redis');
});

export { redisConnection };
