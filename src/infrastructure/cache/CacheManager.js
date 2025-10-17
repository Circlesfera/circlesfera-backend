import redisService from '../../services/redisService.js'
import cache from '../../utils/cache.js'
import logger from '../../utils/logger.js'

/**
 * Sistema de caché avanzado que combina Redis y memoria
 * Implementa estrategias de caché inteligentes para diferentes tipos de datos
 */
class CacheManager {
  constructor() {
    this.strategies = new Map()
    this.defaultTTL = {
      user: 300, // 5 minutos
      post: 600, // 10 minutos
      feed: 180, // 3 minutos
      search: 60, // 1 minuto
      stats: 300, // 5 minutos
      session: 3600, // 1 hora
    }
    this.initializeStrategies()
  }

  /**
   * Inicializar estrategias de caché por tipo de dato
   */
  initializeStrategies() {
    // Estrategia para datos de usuario (caché en memoria + Redis)
    this.strategies.set('user', {
      primary: 'redis',
      fallback: 'memory',
      ttl: this.defaultTTL.user,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    })

    // Estrategia para posts (solo Redis para evitar duplicados)
    this.strategies.set('post', {
      primary: 'redis',
      fallback: 'memory',
      ttl: this.defaultTTL.post,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    })

    // Estrategia para feeds (caché agresivo)
    this.strategies.set('feed', {
      primary: 'redis',
      fallback: 'memory',
      ttl: this.defaultTTL.feed,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    })

    // Estrategia para búsquedas (caché corto)
    this.strategies.set('search', {
      primary: 'memory',
      fallback: 'redis',
      ttl: this.defaultTTL.search,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    })

    // Estrategia para estadísticas (caché largo)
    this.strategies.set('stats', {
      primary: 'redis',
      fallback: 'memory',
      ttl: this.defaultTTL.stats,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    })
  }

  /**
   * Generar clave de caché consistente
   */
  generateKey(type, identifier, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|')

    const paramString = sortedParams ? `|${sortedParams}` : ''
    return `cache:${type}:${identifier}${paramString}`
  }

  /**
   * Obtener valor del caché usando estrategia específica
   */
  async get(type, identifier, params = {}) {
    const strategy = this.strategies.get(type) || this.strategies.get('user')
    const key = this.generateKey(type, identifier, params)

    try {
      let value = null

      // Intentar obtener del almacenamiento primario
      if (strategy.primary === 'redis') {
        const redisValue = await redisService.get(key)
        if (redisValue) {
          value = strategy.deserialize(redisValue)
          logger.debug(`Cache hit (Redis): ${key}`)
        }
      } else {
        const memoryValue = cache.get(key)
        if (memoryValue) {
          value = memoryValue
          logger.debug(`Cache hit (Memory): ${key}`)
        }
      }

      // Si no está en el primario, intentar fallback
      if (!value && strategy.fallback) {
        if (strategy.fallback === 'redis') {
          const redisValue = await redisService.get(key)
          if (redisValue) {
            value = strategy.deserialize(redisValue)
            // Promover a memoria si está en Redis pero no en memoria
            if (strategy.primary === 'memory') {
              cache.set(key, value, strategy.ttl)
            }
            logger.debug(`Cache hit (Redis fallback): ${key}`)
          }
        } else {
          const memoryValue = cache.get(key)
          if (memoryValue) {
            value = memoryValue
            logger.debug(`Cache hit (Memory fallback): ${key}`)
          }
        }
      }

      if (!value) {
        logger.debug(`Cache miss: ${key}`)
      }

      return value
    } catch (error) {
      logger.error(`Error getting cache value for ${key}:`, error)
      return null
    }
  }

  /**
   * Establecer valor en caché usando estrategia específica
   */
  async set(type, identifier, value, params = {}, customTTL = null) {
    const strategy = this.strategies.get(type) || this.strategies.get('user')
    const key = this.generateKey(type, identifier, params)
    const ttl = customTTL || strategy.ttl

    try {
      // Guardar en almacenamiento primario
      if (strategy.primary === 'redis') {
        const serializedValue = strategy.serialize(value)
        await redisService.set(key, serializedValue, ttl)
      } else {
        cache.set(key, value, ttl)
      }

      // Guardar en fallback si es diferente
      if (strategy.fallback && strategy.fallback !== strategy.primary) {
        if (strategy.fallback === 'redis') {
          const serializedValue = strategy.serialize(value)
          await redisService.set(key, serializedValue, ttl)
        } else {
          cache.set(key, value, ttl)
        }
      }

      logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`)
      return true
    } catch (error) {
      logger.error(`Error setting cache value for ${key}:`, error)
      return false
    }
  }

  /**
   * Eliminar valor del caché
   */
  async delete(type, identifier, params = {}) {
    const key = this.generateKey(type, identifier, params)

    try {
      // Eliminar de ambos almacenamientos
      await redisService.del(key)
      cache.delete(key)

      logger.debug(`Cache delete: ${key}`)
      return true
    } catch (error) {
      logger.error(`Error deleting cache value for ${key}:`, error)
      return false
    }
  }

  /**
   * Invalidar caché por patrón
   */
  async invalidatePattern(type, pattern) {
    try {
      const keys = await redisService.keys(`cache:${type}:*${pattern}*`)

      for (const key of keys) {
        await redisService.del(key)
        cache.delete(key)
      }

      logger.info(`Cache invalidated: ${keys.length} keys matching pattern ${pattern}`)
      return keys.length
    } catch (error) {
      logger.error(`Error invalidating cache pattern ${pattern}:`, error)
      return 0
    }
  }

  /**
   * Obtener o establecer (cache-aside pattern)
   */
  async getOrSet(type, identifier, fetchFunction, params = {}, customTTL = null) {
    // Intentar obtener del caché
    let value = await this.get(type, identifier, params)

    if (value === null) {
      // No está en caché, obtener de la fuente original
      try {
        value = await fetchFunction()
        if (value !== null && value !== undefined) {
          // Guardar en caché para futuras consultas
          await this.set(type, identifier, value, params, customTTL)
        }
      } catch (error) {
        logger.error(`Error in getOrSet for ${identifier}:`, error)
        throw error
      }
    }

    return value
  }

  /**
   * Invalidar caché relacionado con un usuario
   */
  async invalidateUserCache(userId) {
    const patterns = [
      `user:${userId}`,
      `feed:${userId}`,
      `posts:${userId}`,
    ]

    let totalInvalidated = 0
    for (const pattern of patterns) {
      totalInvalidated += await this.invalidatePattern('', pattern)
    }

    return totalInvalidated
  }

  /**
   * Invalidar caché relacionado con un post
   */
  async invalidatePostCache(postId, authorId) {
    const patterns = [
      `post:${postId}`,
      `feed:${authorId}`, // Invalidar feed del autor
    ]

    let totalInvalidated = 0
    for (const pattern of patterns) {
      totalInvalidated += await this.invalidatePattern('', pattern)
    }

    return totalInvalidated
  }

  /**
   * Obtener estadísticas del caché
   */
  async getStats() {
    const memoryStats = cache.getStats()

    try {
      const redisKeys = await redisService.keys('cache:*')
      return {
        memory: memoryStats,
        redis: {
          keys: redisKeys.length,
          keysByType: this.getKeysByType(redisKeys)
        },
        strategies: Object.fromEntries(this.strategies)
      }
    } catch (error) {
      logger.error('Error getting cache stats:', error)
      return {
        memory: memoryStats,
        redis: { error: 'Unable to get Redis stats' },
        strategies: Object.fromEntries(this.strategies)
      }
    }
  }

  /**
   * Agrupar claves por tipo
   */
  getKeysByType(keys) {
    const types = {}
    for (const key of keys) {
      const parts = key.split(':')
      if (parts.length >= 3) {
        const type = parts[1]
        types[type] = (types[type] || 0) + 1
      }
    }
    return types
  }

  /**
   * Limpiar todo el caché (solo para desarrollo/testing)
   */
  async clear() {
    try {
      await redisService.flushDb()
      cache.clear()
      logger.info('Cache cleared completely')
      return true
    } catch (error) {
      logger.error('Error clearing cache:', error)
      return false
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager()

export default cacheManager
