/**
 * Servicio de Caching Avanzado para CircleSfera
 * Incluye estrategias de cache inteligente, invalidación y métricas
 */

import redisService from './redisService.js'
import logger from '../utils/logger.js'

class CacheService {
  constructor() {
    this.defaultTTL = {
      user: 300, // 5 minutos
      post: 180, // 3 minutos
      feed: 60, // 1 minuto
      trending: 300, // 5 minutos
      stats: 600, // 10 minutos
      session: 1800, // 30 minutos
      static: 3600 // 1 hora
    }

    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    }
  }

  /**
   * Generar clave de cache con namespace
   * @param {string} namespace - Namespace (user, post, feed, etc.)
   * @param {string} key - Clave específica
   * @param {object} options - Opciones adicionales
   * @returns {string}
   */
  generateKey(namespace, key, options = {}) {
    const { version = 'v1', userId, filters } = options
    let cacheKey = `${namespace}:${version}:${key}`

    if (userId) {
      cacheKey = `${namespace}:${version}:user:${userId}:${key}`
    }

    if (filters) {
      const filterString = Object.entries(filters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(':')
      cacheKey += `:${filterString}`
    }

    return cacheKey
  }

  /**
   * Obtener valor del cache
   * @param {string} key - Clave del cache
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const value = await redisService.get(key)

      if (value) {
        this.cacheStats.hits++
        logger.debug(`Cache HIT: ${key}`)
        return JSON.parse(value)
      }
      this.cacheStats.misses++
      logger.debug(`Cache MISS: ${key}`)
      return null
    } catch (error) {
      logger.error(`Error getting cache key ${key}:`, error)
      this.cacheStats.misses++
      return null
    }
  }

  /**
   * Guardar valor en cache
   * @param {string} key - Clave del cache
   * @param {any} value - Valor a guardar
   * @param {number} ttl - Tiempo de vida en segundos
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = null) {
    try {
      const serializedValue = JSON.stringify(value)
      await redisService.set(key, serializedValue, ttl)
      this.cacheStats.sets++
      logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'default'})`)
      return true
    } catch (error) {
      logger.error(`Error setting cache key ${key}:`, error)
      return false
    }
  }

  /**
   * Eliminar clave del cache
   * @param {string} key - Clave del cache
   * @returns {Promise<boolean>}
   */
  async del(key) {
    try {
      const result = await redisService.del(key)
      this.cacheStats.deletes++
      logger.debug(`Cache DEL: ${key}`)
      return result > 0
    } catch (error) {
      logger.error(`Error deleting cache key ${key}:`, error)
      return false
    }
  }

  /**
   * Eliminar múltiples claves con patrón
   * @param {string} pattern - Patrón de claves
   * @returns {Promise<number>}
   */
  async delPattern(pattern) {
    try {
      const keys = await redisService.keys(pattern)
      if (keys.length === 0) {
        return 0
      }

      let deleted = 0
      for (const key of keys) {
        const result = await redisService.del(key)
        deleted += result
      }

      this.cacheStats.deletes += deleted
      logger.debug(`Cache DEL PATTERN: ${pattern} (${deleted} keys)`)
      return deleted
    } catch (error) {
      logger.error(`Error deleting cache pattern ${pattern}:`, error)
      return 0
    }
  }

  /**
   * Cache con fallback automático
   * @param {string} key - Clave del cache
   * @param {Function} fallbackFn - Función a ejecutar si no hay cache
   * @param {number} ttl - Tiempo de vida
   * @returns {Promise<any>}
   */
  async getOrSet(key, fallbackFn, ttl = null) {
    try {
      // Intentar obtener del cache
      const cached = await this.get(key)
      if (cached !== null) {
        return cached
      }

      // Ejecutar función fallback
      const result = await fallbackFn()

      // Guardar en cache
      if (result !== null && result !== undefined) {
        await this.set(key, result, ttl)
      }

      return result
    } catch (error) {
      logger.error(`Error in getOrSet for key ${key}:`, error)
      // En caso de error, intentar ejecutar fallback
      try {
        return await fallbackFn()
      } catch (fallbackError) {
        logger.error(`Fallback function also failed for key ${key}:`, fallbackError)
        throw fallbackError
      }
    }
  }

  /**
   * Cache de usuario
   * @param {string} userId - ID del usuario
   * @param {Function} fallbackFn - Función para obtener datos del usuario
   * @returns {Promise<any>}
   */
  async getUser(userId, fallbackFn) {
    const key = this.generateKey('user', userId)
    return this.getOrSet(key, fallbackFn, this.defaultTTL.user)
  }

  /**
   * Cache de post
   * @param {string} postId - ID del post
   * @param {Function} fallbackFn - Función para obtener datos del post
   * @returns {Promise<any>}
   */
  async getPost(postId, fallbackFn) {
    const key = this.generateKey('post', postId)
    return this.getOrSet(key, fallbackFn, this.defaultTTL.post)
  }

  /**
   * Cache de feed
   * @param {string} userId - ID del usuario
   * @param {object} filters - Filtros del feed
   * @param {Function} fallbackFn - Función para obtener feed
   * @returns {Promise<any>}
   */
  async getFeed(userId, filters = {}, fallbackFn) {
    const key = this.generateKey('feed', 'main', { userId, filters })
    return this.getOrSet(key, fallbackFn, this.defaultTTL.feed)
  }

  /**
   * Cache de posts trending
   * @param {object} filters - Filtros
   * @param {Function} fallbackFn - Función para obtener trending
   * @returns {Promise<any>}
   */
  async getTrending(filters = {}, fallbackFn) {
    const key = this.generateKey('trending', 'posts', { filters })
    return this.getOrSet(key, fallbackFn, this.defaultTTL.trending)
  }

  /**
   * Cache de estadísticas
   * @param {string} type - Tipo de estadísticas
   * @param {object} filters - Filtros
   * @param {Function} fallbackFn - Función para obtener stats
   * @returns {Promise<any>}
   */
  async getStats(type, filters = {}, fallbackFn) {
    const key = this.generateKey('stats', type, { filters })
    return this.getOrSet(key, fallbackFn, this.defaultTTL.stats)
  }

  /**
   * Invalidar cache de usuario
   * @param {string} userId - ID del usuario
   */
  async invalidateUser(userId) {
    const patterns = [
      `user:v1:${userId}`,
      `user:v1:user:${userId}:*`,
      `feed:v1:user:${userId}:*`,
      `stats:v1:*user:${userId}*`
    ]

    for (const pattern of patterns) {
      await this.delPattern(pattern)
    }

    logger.info(`Cache invalidated for user: ${userId}`)
  }

  /**
   * Invalidar cache de post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario (opcional)
   */
  async invalidatePost(postId, userId = null) {
    const patterns = [
      `post:v1:${postId}`,
      'feed:v1:*',
      'trending:v1:*'
    ]

    if (userId) {
      patterns.push(`user:v1:user:${userId}:*`)
    }

    for (const pattern of patterns) {
      await this.delPattern(pattern)
    }

    logger.info(`Cache invalidated for post: ${postId}`)
  }

  /**
   * Invalidar cache de feed
   * @param {string} userId - ID del usuario (opcional)
   */
  async invalidateFeed(userId = null) {
    const patterns = ['feed:v1:*']

    if (userId) {
      patterns.push(`feed:v1:user:${userId}:*`)
    }

    for (const pattern of patterns) {
      await this.delPattern(pattern)
    }

    logger.info(`Cache invalidated for feed${userId ? ` (user: ${userId})` : ''}`)
  }

  /**
   * Invalidar cache de trending
   */
  async invalidateTrending() {
    await this.delPattern('trending:v1:*')
    logger.info('Cache invalidated for trending')
  }

  /**
   * Invalidar todo el cache
   */
  async invalidateAll() {
    await redisService.flushDb()
    this.cacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0 }
    logger.info('All cache invalidated')
  }

  /**
   * Obtener estadísticas del cache
   * @returns {object}
   */
  getStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      total
    }
  }

  /**
   * Cache con TTL dinámico basado en popularidad
   * @param {string} key - Clave del cache
   * @param {any} value - Valor a guardar
   * @param {number} baseTTL - TTL base
   * @param {number} popularityScore - Score de popularidad (0-1)
   */
  async setWithDynamicTTL(key, value, baseTTL, popularityScore = 0) {
    // TTL más largo para contenido más popular
    const dynamicTTL = Math.floor(baseTTL * (1 + popularityScore * 2))
    return this.set(key, value, dynamicTTL)
  }

  /**
   * Cache con refresh automático
   * @param {string} key - Clave del cache
   * @param {Function} refreshFn - Función de refresh
   * @param {number} ttl - Tiempo de vida
   * @param {number} refreshThreshold - Porcentaje de TTL para refresh (0.8 = 80%)
   */
  async getWithAutoRefresh(key, refreshFn, ttl, refreshThreshold = 0.8) {
    const cached = await this.get(key)

    if (cached && cached._cacheMetadata) {
      const age = Date.now() - cached._cacheMetadata.timestamp
      const agePercentage = age / (ttl * 1000)

      // Si está cerca de expirar, refrescar en background
      if (agePercentage > refreshThreshold) {
        // Refresh en background (no esperar)
        refreshFn().then(result => {
          if (result) {
            this.set(key, { ...result, _cacheMetadata: { timestamp: Date.now() } }, ttl)
          }
        }).catch(error => {
          logger.error(`Background refresh failed for key ${key}:`, error)
        })
      }
    }

    return cached
  }
}

// Singleton
const cacheService = new CacheService()

export default cacheService
