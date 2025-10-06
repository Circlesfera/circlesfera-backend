const Redis = require('ioredis');
const { config } = require('../utils/config');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Inicializar conexión a Redis
 * Solo se conecta en producción si REDIS_URL está configurado
 */
const initRedis = () => {
  if (config.redisUrl && config.nodeEnv === 'production') {
    try {
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        enableReadyCheck: true,
        enableOfflineQueue: true,
      });

      redisClient.on('connect', () => {
        logger.info('✅ Conectado a Redis');
      });

      redisClient.on('error', error => {
        logger.error('❌ Error de Redis:', error);
      });

      redisClient.on('ready', () => {
        logger.info('🚀 Redis listo para usar');
      });

      redisClient.on('close', () => {
        logger.warn('⚠️ Conexión a Redis cerrada');
      });

      return redisClient;
    } catch (error) {
      logger.error('Error inicializando Redis:', error);
      return null;
    }
  } else {
    logger.info('ℹ️ Redis no configurado, usando caché en memoria');
    return null;
  }
};

/**
 * Obtener cliente de Redis
 * @returns {Redis|null} Cliente de Redis o null si no está disponible
 */
const getRedisClient = () => {
  if (!redisClient && config.redisUrl && config.nodeEnv === 'production') {
    return initRedis();
  }
  return redisClient;
};

/**
 * Cerrar conexión a Redis
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis desconectado');
  }
};

/**
 * Verificar si Redis está disponible y conectado
 * @returns {boolean}
 */
const isRedisAvailable = () => {
  return redisClient !== null && redisClient.status === 'ready';
};

module.exports = {
  initRedis,
  getRedisClient,
  closeRedis,
  isRedisAvailable,
};
