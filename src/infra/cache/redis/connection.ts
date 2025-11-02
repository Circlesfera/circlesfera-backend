import { Redis, type RedisOptions } from 'ioredis';

import { env } from '@config/index.js';
import { logger } from '@infra/logger/logger.js';

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

const createOptions = (): RedisOptions => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  tls: env.REDIS_TLS ? {} : undefined,
  maxRetriesPerRequest: 3,
  enableAutoPipelining: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Solo reconectar en casos específicos
      return true;
    }
    return false;
  }
});

const attachLogging = (instance: Redis, label: string): void => {
  // Handler de errores (requerido para evitar warnings)
  instance.on('error', (error: Error) => {
    logger.error({ err: error, label }, 'Error en Redis');
  });

  // Handler de conexión establecida
  instance.on('connect', () => {
    logger.info({ label }, 'Conexión a Redis establecida');
  });

  // Handler de reconexión (mejora el manejo de ECONNRESET)
  instance.on('ready', () => {
    logger.info({ label }, 'Redis listo');
  });

  // Handler de desconexión
  instance.on('close', () => {
    logger.warn({ label }, 'Conexión a Redis cerrada');
  });

  // Handler de reconexión en progreso
  instance.on('reconnecting', (delay: number) => {
    logger.info({ label, delay }, 'Reconectando a Redis...');
  });
};

/**
 * Devuelve un cliente singleton de Redis para operaciones generales (cache, rate limiting).
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(createOptions());
    attachLogging(redisClient, 'primary');
  }

  return redisClient;
};

/**
 * Devuelve un cliente dedicado para pub/sub (utilizado por websockets y colas).
 */
export const getRedisSubscriber = (): Redis => {
  if (!redisSubscriber) {
    redisSubscriber = new Redis(createOptions());
    attachLogging(redisSubscriber, 'subscriber');
  }

  return redisSubscriber;
};

/**
 * Cierra las conexiones abiertas de Redis. Útil en pruebas y apagado controlado.
 */
export const closeRedisConnections = async (): Promise<void> => {
  await Promise.all([
    redisClient?.quit().catch((error: Error) => {
      logger.error({ err: error }, 'Error al cerrar Redis primario');
    }),
    redisSubscriber?.quit().catch((error: Error) => {
      logger.error({ err: error }, 'Error al cerrar Redis subscriber');
    })
  ]);

  redisClient = null;
  redisSubscriber = null;
};

