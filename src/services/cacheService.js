/**
 * Servicio de Caché Inteligente con Redis
 * Fase 2: Performance Crítico
 *
 * Implementa caché para:
 * - Perfiles de usuario
 * - Feeds personalizados
 * - Stories activas
 * - Posts populares
 * - Estadísticas de usuario
 */

import redisService from './redisService.js'
import logger from '../utils/logger.js'
import { CACHE_TTL } from '../config/constants.js'

class CacheService {
  constructor() {
    // Configuración de TTL (tiempo de vida) por tipo de dato
    // Usar constantes centralizadas en lugar de hardcodear valores
    this.TTL = {
      USER_PROFILE: CACHE_TTL.USER_PROFILE, // 15 minutos
      USER_STATS: CACHE_TTL.USER_STATS, // 10 minutos
      FEED: CACHE_TTL.FEED, // 5 minutos
      STORIES: CACHE_TTL.STORIES, // 2 minutos
      TRENDING_POSTS: CACHE_TTL.TRENDING_POSTS, // 30 minutos
      TRENDING_REELS: CACHE_TTL.TRENDING_POSTS, // 30 minutos
      POST_DETAIL: CACHE_TTL.USER_STATS, // 10 minutos
      REEL_DETAIL: CACHE_TTL.USER_STATS, // 10 minutos
      CONVERSATIONS: CACHE_TTL.FEED // 5 minutos
    }

    // Prefijos de claves para organización
    this.KEYS = {
      USER_PROFILE: 'user:profile:',
      USER_STATS: 'user:stats:',
      FEED: 'feed:',
      STORIES: 'stories:',
      TRENDING_POSTS: 'trending:posts',
      TRENDING_REELS: 'trending:reels',
      POST: 'post:',
      REEL: 'reel:',
      CONVERSATIONS: 'conversations:'
    }
  }

  /**
   * Obtener datos del caché con manejo de JSON
   * @param {string} key - Clave del caché
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const cached = await redisService.get(key)

      if (!cached) {
        return null
      }

      // Intentar parsear JSON
      try {
        return JSON.parse(cached)
      } catch {
        // Si no es JSON, devolver string (comportamiento esperado para algunos valores)
        // No loggeamos en debug porque es comportamiento normal
        return cached
      }
    } catch (error) {
      logger.error(`Error al obtener del caché (${key}):`, error)
      return null
    }
  }

  /**
   * Guardar datos en el caché con serialización JSON
   * @param {string} key - Clave del caché
   * @param {any} value - Valor a guardar
   * @param {number} ttl - Tiempo de vida en segundos
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = null) {
    try {
      // Serializar a JSON si es objeto
      const serialized = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)

      await redisService.set(key, serialized, ttl)
      return true
    } catch (error) {
      logger.error(`Error al guardar en caché (${key}):`, error)
      return false
    }
  }

  /**
   * Eliminar del caché
   * @param {string} key - Clave del caché
   * @returns {Promise<boolean>}
   */
  async del(key) {
    try {
      await redisService.del(key)
      return true
    } catch (error) {
      logger.error(`Error al eliminar del caché (${key}):`, error)
      return false
    }
  }

  /**
   * Eliminar múltiples claves por patrón
   * @param {string} pattern - Patrón de búsqueda (ej: 'user:*')
   * @returns {Promise<number>} Número de claves eliminadas
   */
  async delPattern(pattern) {
    try {
      const keys = await redisService.keys(pattern)
      if (keys.length === 0) { return 0 }

      await Promise.all(keys.map(key => redisService.del(key)))
      const deleted = keys.length

      logger.info(`Caché invalidado: ${deleted} claves eliminadas (${pattern})`)
      return deleted
    } catch (error) {
      logger.error(`Error al eliminar patrón de caché (${pattern}):`, error)
      return 0
    }
  }

  /**
   * Wrapper para obtener o ejecutar función si no existe en caché
   * @param {string} key - Clave del caché
   * @param {Function} fn - Función a ejecutar si no hay caché
   * @param {number} ttl - TTL en segundos
   * @returns {Promise<any>}
   */
  async getOrSet(key, fn, ttl) {
    // Intentar obtener del caché
    const cached = await this.get(key)

    if (cached !== null) {
      logger.debug(`Cache HIT: ${key}`)
      return cached
    }

    // Si no existe, ejecutar función
    logger.debug(`Cache MISS: ${key}`)
    const result = await fn()

    // Guardar en caché si el resultado no es null/undefined
    if (result !== null && result !== undefined) {
      await this.set(key, result, ttl)
    }

    return result
  }

  // ========== MÉTODOS ESPECÍFICOS PARA ENTIDADES ==========

  /**
   * Obtener perfil de usuario del caché
   * @param {string} username - Username del usuario
   * @returns {Promise<object|null>}
   */
  getUserProfile(username) {
    const key = `${this.KEYS.USER_PROFILE}${username.toLowerCase()}`
    return this.get(key)
  }

  /**
   * Guardar perfil de usuario en caché
   * @param {string} username - Username del usuario
   * @param {object} profile - Datos del perfil
   * @returns {Promise<boolean>}
   */
  setUserProfile(username, profile) {
    const key = `${this.KEYS.USER_PROFILE}${username.toLowerCase()}`
    return this.set(key, profile, this.TTL.USER_PROFILE)
  }

  /**
   * Invalidar caché de perfil de usuario
   * @param {string} username - Username del usuario
   * @returns {Promise<boolean>}
   */
  invalidateUserProfile(username) {
    const key = `${this.KEYS.USER_PROFILE}${username.toLowerCase()}`
    return this.del(key)
  }

  /**
   * Obtener feed personalizado del caché
   * @param {string} userId - ID del usuario
   * @param {number} page - Página
   * @returns {Promise<object|null>}
   */
  getFeed(userId, page = 1) {
    const key = `${this.KEYS.FEED}${userId}:page:${page}`
    return this.get(key)
  }

  /**
   * Guardar feed personalizado en caché
   * @param {string} userId - ID del usuario
   * @param {number} page - Página
   * @param {object} feed - Datos del feed
   * @returns {Promise<boolean>}
   */
  setFeed(userId, page, feed) {
    const key = `${this.KEYS.FEED}${userId}:page:${page}`
    return this.set(key, feed, this.TTL.FEED)
  }

  /**
   * Invalidar caché de feed de usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<number>}
   */
  invalidateFeed(userId) {
    const pattern = `${this.KEYS.FEED}${userId}:*`
    return this.delPattern(pattern)
  }

  /**
   * Invalidar feed de todos los seguidores de un usuario
   * (Útil cuando un usuario crea nuevo contenido)
   * @param {Array<string>} followerIds - IDs de los seguidores
   * @returns {Promise<number>}
   */
  async invalidateFollowersFeeds(followerIds) {
    const deletedCounts = await Promise.all(
      followerIds.map(followerId => this.invalidateFeed(followerId))
    )
    return deletedCounts.reduce((sum, count) => sum + count, 0)
  }

  /**
   * Obtener stories activas del caché
   * @param {string} userId - ID del usuario solicitante
   * @returns {Promise<object|null>}
   */
  getStories(userId) {
    const key = `${this.KEYS.STORIES}${userId}`
    return this.get(key)
  }

  /**
   * Guardar stories activas en caché
   * @param {string} userId - ID del usuario solicitante
   * @param {object} stories - Datos de stories
   * @returns {Promise<boolean>}
   */
  setStories(userId, stories) {
    const key = `${this.KEYS.STORIES}${userId}`
    return this.set(key, stories, this.TTL.STORIES)
  }

  /**
   * Invalidar caché de stories
   * @param {string} userId - ID del usuario (opcional)
   * @returns {Promise<number>}
   */
  async invalidateStories(userId = null) {
    const pattern = userId
      ? `${this.KEYS.STORIES}${userId}`
      : `${this.KEYS.STORIES}*`

    if (userId) {
      const result = await this.del(pattern)
      return result ? 1 : 0
    }
    return this.delPattern(pattern)

  }

  /**
   * Obtener posts trending del caché
   * @returns {Promise<object|null>}
   */
  getTrendingPosts() {
    return this.get(this.KEYS.TRENDING_POSTS)
  }

  /**
   * Guardar posts trending en caché
   * @param {object} posts - Posts trending
   * @returns {Promise<boolean>}
   */
  setTrendingPosts(posts) {
    return this.set(this.KEYS.TRENDING_POSTS, posts, this.TTL.TRENDING_POSTS)
  }

  /**
   * Obtener reels trending del caché
   * @returns {Promise<object|null>}
   */
  getTrendingReels() {
    return this.get(this.KEYS.TRENDING_REELS)
  }

  /**
   * Guardar reels trending en caché
   * @param {object} reels - Reels trending
   * @returns {Promise<boolean>}
   */
  setTrendingReels(reels) {
    return this.set(this.KEYS.TRENDING_REELS, reels, this.TTL.TRENDING_REELS)
  }

  /**
   * Obtener post específico del caché
   * @param {string} postId - ID del post
   * @returns {Promise<object|null>}
   */
  getPost(postId) {
    const key = `${this.KEYS.POST}${postId}`
    return this.get(key)
  }

  /**
   * Guardar post específico en caché
   * @param {string} postId - ID del post
   * @param {object} post - Datos del post
   * @returns {Promise<boolean>}
   */
  setPost(postId, post) {
    const key = `${this.KEYS.POST}${postId}`
    return this.set(key, post, this.TTL.POST_DETAIL)
  }

  /**
   * Invalidar caché de post específico
   * @param {string} postId - ID del post
   * @returns {Promise<boolean>}
   */
  invalidatePost(postId) {
    const key = `${this.KEYS.POST}${postId}`
    return this.del(key)
  }

  /**
   * Obtener estadísticas de caché
   * @returns {Promise<object>}
   */
  async getStats() {
    try {
      const patterns = [
        { name: 'User Profiles', pattern: 'user:profile:*' },
        { name: 'Feeds', pattern: 'feed:*' },
        { name: 'Stories', pattern: 'stories:*' },
        { name: 'Posts', pattern: 'post:*' },
        { name: 'Reels', pattern: 'reel:*' }
      ]

      const stats = {}
      const results = await Promise.all(
        patterns.map(async ({ name, pattern }) => ({
          name,
          count: (await redisService.keys(pattern)).length
        }))
      )

      results.forEach(({ name, count }) => {
        stats[name] = count
      })

      return stats
    } catch (error) {
      logger.error('Error al obtener estadísticas de caché:', error)
      return {}
    }
  }

  /**
   * Limpiar todo el caché (usar con precaución)
   * @returns {Promise<number>}
   */
  flush() {
    logger.warn('⚠️ Limpiando TODO el caché...')
    return this.delPattern('*')
  }
}

// Singleton
const cacheService = new CacheService()

export default cacheService

