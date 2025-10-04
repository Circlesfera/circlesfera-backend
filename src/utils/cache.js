const redis = require('redis');
const logger = require('./logger');

let client = null;
let isConnected = false;

/**
 * Inicializar conexión a Redis
 */
const initRedis = async () => {
  const redisUrl = process.env.REDIS_URL;

  // Redis es opcional
  if (!redisUrl) {
    logger.info('Redis no configurado - caching deshabilitado');
    return null;
  }

  try {
    client = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Máximo de reintentos alcanzado');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    // Event handlers
    client.on('error', (err) => {
      logger.error('Redis error:', err);
      isConnected = false;
    });

    client.on('connect', () => {
      logger.info('✅ Redis conectado');
      isConnected = true;
    });

    client.on('disconnect', () => {
      logger.warn('Redis desconectado');
      isConnected = false;
    });

    await client.connect();

    return client;
  } catch (error) {
    logger.error('Error al conectar Redis:', error);
    logger.info('La aplicación continuará sin cache');
    return null;
  }
};

/**
 * Utilidad de cache con fallback si Redis no está disponible
 */
const cache = {
  /**
   * Obtener valor del cache
   */
  get: async (key) => {
    if (!client || !isConnected) return null;

    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting from cache:', error);
      return null;
    }
  },

  /**
   * Guardar en cache
   */
  set: async (key, value, ttl = 3600) => {
    if (!client || !isConnected) return false;

    try {
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Error setting cache:', error);
      return false;
    }
  },

  /**
   * Eliminar del cache
   */
  del: async (key) => {
    if (!client || !isConnected) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Error deleting from cache:', error);
      return false;
    }
  },

  /**
   * Eliminar múltiples keys por patrón
   */
  delPattern: async (pattern) => {
    if (!client || !isConnected) return false;

    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error('Error deleting cache pattern:', error);
      return false;
    }
  },

  /**
   * Verificar si existe una key
   */
  exists: async (key) => {
    if (!client || !isConnected) return false;

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Error checking cache existence:', error);
      return false;
    }
  },

  /**
   * Incrementar contador
   */
  incr: async (key) => {
    if (!client || !isConnected) return 0;

    try {
      return await client.incr(key);
    } catch (error) {
      logger.error('Error incrementing cache:', error);
      return 0;
    }
  },

  /**
   * Establecer expiración
   */
  expire: async (key, ttl) => {
    if (!client || !isConnected) return false;

    try {
      await client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Error setting expiration:', error);
      return false;
    }
  },

  /**
   * Limpiar todo el cache
   */
  flush: async () => {
    if (!client || !isConnected) return false;

    try {
      await client.flushAll();
      logger.info('Cache limpiado completamente');
      return true;
    } catch (error) {
      logger.error('Error flushing cache:', error);
      return false;
    }
  },

  /**
   * Verificar si Redis está conectado
   */
  isReady: () => {
    return isConnected;
  },
};

/**
 * Middleware de cache para responses
 */
const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Solo cachear GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await cache.get(key);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Interceptar res.json para cachear
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        res.setHeader('X-Cache', 'MISS');
        cache.set(key, data, ttl);
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

module.exports = {
  initRedis,
  cache,
  cacheMiddleware,
};

