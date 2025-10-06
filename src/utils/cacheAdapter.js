const { getRedisClient, isRedisAvailable } = require('../config/redis');
const memoryCacheService = require('./cacheService');
const logger = require('./logger');

// Mantener referencia al cliente de Redis
let redisInitialized = false;

/**
 * Adaptador de caché que usa Redis en producción y memoria en desarrollo
 * Proporciona una interfaz unificada para ambos sistemas
 */
class CacheAdapter {
  constructor() {
    // Intentar inicializar Redis al crear la instancia
    if (!redisInitialized) {
      try {
        getRedisClient();
        redisInitialized = true;
      } catch (error) {
        logger.warn('No se pudo inicializar Redis, usando caché en memoria');
      }
    }
  }
  /**
   * Obtener valor del caché
   * @param {string} key - Clave del caché
   * @returns {Promise<any|null>} Valor almacenado o null
   */
  async get(key) {
    try {
      if (isRedisAvailable()) {
        const redisClient = getRedisClient();
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        return memoryCacheService.get(key);
      }
    } catch (error) {
      logger.error('Error obteniendo del caché:', error);
      return null;
    }
  }

  /**
   * Guardar valor en caché
   * @param {string} key - Clave del caché
   * @param {any} value - Valor a almacenar
   * @param {number} ttlSeconds - Tiempo de vida en segundos
   */
  async set(key, value, ttlSeconds = 300) {
    try {
      if (isRedisAvailable()) {
        const redisClient = getRedisClient();
        const serialized = JSON.stringify(value);

        if (ttlSeconds > 0) {
          await redisClient.setex(key, ttlSeconds, serialized);
        } else {
          await redisClient.set(key, serialized);
        }
      } else {
        memoryCacheService.set(key, value, ttlSeconds);
      }
    } catch (error) {
      logger.error('Error guardando en caché:', error);
    }
  }

  /**
   * Eliminar valor del caché
   * @param {string} key - Clave a eliminar
   */
  async delete(key) {
    try {
      if (isRedisAvailable()) {
        const redisClient = getRedisClient();
        await redisClient.del(key);
      } else {
        memoryCacheService.delete(key);
      }
    } catch (error) {
      logger.error('Error eliminando del caché:', error);
    }
  }

  /**
   * Eliminar múltiples claves que coincidan con un patrón
   * @param {string} pattern - Patrón de búsqueda (ej: 'user:*')
   */
  async deletePattern(pattern) {
    try {
      if (isRedisAvailable()) {
        const redisClient = getRedisClient();
        const keys = await redisClient.keys(pattern);

        if (keys.length > 0) {
          await redisClient.del(...keys);
          logger.info(
            `Eliminadas ${keys.length} claves del caché con patrón ${pattern}`
          );
        }
      } else {
        memoryCacheService.deletePattern(pattern);
      }
    } catch (error) {
      logger.error('Error eliminando patrón del caché:', error);
    }
  }

  /**
   * Limpiar todo el caché
   */
  async clear() {
    try {
      if (isRedisAvailable()) {
        const redisClient = getRedisClient();
        await redisClient.flushdb();
        logger.info('Caché Redis completamente limpiado');
      } else {
        memoryCacheService.clear();
      }
    } catch (error) {
      logger.error('Error limpiando caché:', error);
    }
  }

  /**
   * Obtener o crear valor en caché
   * @param {string} key - Clave del caché
   * @param {Function} fetchFn - Función asíncrona para obtener el valor
   * @param {number} ttlSeconds - Tiempo de vida en segundos
   * @returns {Promise<any>} Valor del caché o resultado de fetchFn
   */
  async getOrSet(key, fetchFn, ttlSeconds = 300) {
    try {
      const cached = await this.get(key);

      if (cached !== null) {
        return cached;
      }

      const value = await fetchFn();
      await this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      logger.error('Error en getOrSet:', error);
      return await fetchFn();
    }
  }

  /**
   * Obtener estadísticas del caché
   * @returns {Promise<Object>} Estadísticas del caché
   */
  async getStats() {
    try {
      if (isRedisAvailable()) {
        const redisClient = getRedisClient();
        const info = await redisClient.info('stats');
        const dbsize = await redisClient.dbsize();

        return {
          type: 'redis',
          size: dbsize,
          info,
        };
      } else {
        return {
          type: 'memory',
          ...memoryCacheService.getStats(),
        };
      }
    } catch (error) {
      logger.error('Error obteniendo stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Verificar si está usando Redis
   * @returns {boolean}
   */
  isUsingRedis() {
    return isRedisAvailable();
  }
}

// Exportar instancia única (singleton)
const cacheAdapter = new CacheAdapter();

module.exports = cacheAdapter;
