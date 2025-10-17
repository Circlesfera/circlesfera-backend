import cacheManager from './CacheManager.js'
import logger from '../../utils/logger.js'

/**
 * Decorador para métodos que necesitan caché
 * Aplica automáticamente estrategias de caché a métodos de clase
 */
export const Cacheable = (options = {}) => function (target, propertyName, descriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args) {
    const {
      type = 'default',
      keyGenerator = null,
      ttl = null,
      invalidateOn = [],
      skipCache = false
    } = options

    // Generar clave de caché
    let cacheKey
    if (keyGenerator && typeof keyGenerator === 'function') {
      cacheKey = keyGenerator(...args)
    } else {
      // Generar clave automáticamente basada en el método y argumentos
      const className = target.constructor.name
      const methodName = propertyName
      const argsHash = JSON.stringify(args)
      cacheKey = `${className}:${methodName}:${Buffer.from(argsHash).toString('base64')}`
    }

    // Verificar si debemos saltar el caché
    if (skipCache) {
      logger.debug(`Cache skipped for ${cacheKey}`)
      return originalMethod.apply(this, args)
    }

    try {
      // Intentar obtener del caché
      const cachedResult = await cacheManager.get(type, cacheKey)
      if (cachedResult !== null) {
        logger.debug(`Cache hit for ${cacheKey}`)
        return cachedResult
      }

      // Ejecutar método original
      logger.debug(`Cache miss for ${cacheKey}, executing method`)
      const result = await originalMethod.apply(this, args)

      // Guardar resultado en caché
      if (result !== null && result !== undefined) {
        await cacheManager.set(type, cacheKey, result, {}, ttl)
        logger.debug(`Result cached for ${cacheKey}`)
      }

      return result
    } catch (error) {
      logger.error(`Error in cached method ${propertyName}:`, error)
      throw error
    }
  }

  return descriptor
}

/**
 * Decorador para invalidar caché después de operaciones de escritura
 */
export const CacheInvalidate = (options = {}) => function (target, propertyName, descriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args) {
    const { patterns = [], type = 'default' } = options

    try {
      // Ejecutar método original
      const result = await originalMethod.apply(this, args)

      // Invalidar caché según los patrones especificados
      for (const pattern of patterns) {
        if (typeof pattern === 'function') {
          const patternResult = pattern(...args, result)
          if (patternResult) {
            await cacheManager.invalidatePattern(type, patternResult)
          }
        } else {
          await cacheManager.invalidatePattern(type, pattern)
        }
      }

      logger.debug(`Cache invalidated for method ${propertyName}`)
      return result
    } catch (error) {
      logger.error(`Error in cache invalidation for ${propertyName}:`, error)
      throw error
    }
  }

  return descriptor
}

/**
 * Decorador para caché condicional
 */
export const CacheWhen = (condition) => function (target, propertyName, descriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args) {
    const shouldCache = typeof condition === 'function'
      ? condition(...args)
      : condition

    if (!shouldCache) {
      return originalMethod.apply(this, args)
    }

    // Aplicar caché normal
    return Cacheable()(target, propertyName, descriptor).value.apply(this, args)
  }

  return descriptor
}

/**
 * Helper para generar claves de caché
 */
export const CacheKeys = {
  user: (userId) => `user:${userId}`,
  userProfile: (userId) => `user:profile:${userId}`,
  userPosts: (userId, page = 1, limit = 10) => `user:posts:${userId}:${page}:${limit}`,
  post: (postId) => `post:${postId}`,
  postComments: (postId, page = 1) => `post:comments:${postId}:${page}`,
  feed: (userId, page = 1, limit = 10) => `feed:${userId}:${page}:${limit}`,
  search: (query, filters = {}) => {
    const filtersStr = Object.keys(filters).sort().map(k => `${k}:${filters[k]}`).join('|')
    return `search:${query}:${filtersStr}`
  },
  trending: (type, period = 'daily') => `trending:${type}:${period}`,
  stats: (type, period = 'daily') => `stats:${type}:${period}`
}

/**
 * Helper para patrones de invalidación
 */
export const InvalidationPatterns = {
  userPosts: (userId) => `user:posts:${userId}:*`,
  userFeed: (userId) => `feed:${userId}:*`,
  postRelated: (postId) => `post:${postId}:*`,
  allFeeds: () => 'feed:*',
  allSearches: () => 'search:*',
  allTrending: () => 'trending:*'
}
