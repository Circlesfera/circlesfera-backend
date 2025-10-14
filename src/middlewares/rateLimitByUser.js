/**
 * Middleware de Rate Limiting por Usuario
 * Complementa el rate limiting por IP con límites específicos por usuario autenticado
 */

import redisService from '../services/redisService.js'
import logger from '../utils/logger.js'
import { config } from '../utils/config.js'

/**
 * Configuración de límites por operación
 */
const RATE_LIMITS = {
  // Operaciones de autenticación
  auth: {
    login: { max: 5, window: 15 * 60 }, // 5 intentos en 15 min
    register: { max: 3, window: 60 * 60 }, // 3 registros en 1 hora
    refreshToken: { max: 10, window: 15 * 60 } // 10 refresh en 15 min
  },

  // Operaciones de contenido
  content: {
    createPost: { max: 20, window: 60 * 60 }, // 20 posts en 1 hora
    createReel: { max: 15, window: 60 * 60 }, // 15 reels en 1 hora
    createStory: { max: 30, window: 60 * 60 }, // 30 stories en 1 hora
    createComment: { max: 50, window: 60 * 60 }, // 50 comentarios en 1 hora
    deletePost: { max: 30, window: 60 * 60 }, // 30 eliminaciones en 1 hora
    updatePost: { max: 40, window: 60 * 60 } // 40 actualizaciones en 1 hora
  },

  // Operaciones sociales
  social: {
    like: { max: 200, window: 60 * 60 }, // 200 likes en 1 hora
    follow: { max: 100, window: 60 * 60 }, // 100 follows en 1 hora
    unfollow: { max: 100, window: 60 * 60 }, // 100 unfollows en 1 hora
    sendMessage: { max: 1000, window: 60 * 60 } // 1000 mensajes en 1 hora (desarrollo)
  },

  // Operaciones de búsqueda/consulta
  query: {
    search: { max: 1000, window: 15 * 60 }, // 1000 búsquedas en 15 min (desarrollo)
    feed: { max: 1000, window: 15 * 60 } // 1000 consultas al feed en 15 min (desarrollo)
  },

  // Operaciones peligrosas
  dangerous: {
    changePassword: { max: 3, window: 60 * 60 }, // 3 cambios en 1 hora
    deleteAccount: { max: 1, window: 24 * 60 * 60 } // 1 intento en 24 horas
  },

  // Default para operaciones no especificadas
  default: { max: 100, window: 15 * 60 } // 100 operaciones en 15 min
}

/**
 * Obtener límite para una operación
 * @param {string} operation - Nombre de la operación
 * @returns {{max: number, window: number}}
 */
const getLimitForOperation = (operation) => {
  // Buscar en todas las categorías
  for (const category of Object.values(RATE_LIMITS)) {
    if (category[operation]) {
      return category[operation]
    }
  }

  return RATE_LIMITS.default
}

/**
 * Middleware de rate limiting por usuario
 * @param {string} operation - Nombre de la operación (ej: 'createPost', 'login')
 * @param {object} options - Opciones de configuración
 * @returns {Function} Middleware
 */
export const rateLimitByUser = (operation, options = {}) => {
  const limit = options.limit || getLimitForOperation(operation)
  const { max, window } = limit

  return async (req, res, next) => {
    try {
      // En desarrollo, ser más permisivo
      if (config.isDevelopment && !options.enforceInDev) {
        return next()
      }

      // Requiere autenticación (el usuario debe estar en req.user o req.userId)
      const userId = req.user?._id || req.userId

      if (!userId) {
        // Si no hay usuario, pasar (el rate limiting por IP ya se encarga)
        return next()
      }

      // Clave en Redis: ratelimit:user:{userId}:{operation}
      const key = `ratelimit:user:${userId}:${operation}`

      // Obtener contador actual
      const count = await redisService.get(key)

      if (!count) {
        // Primera vez, inicializar contador
        await redisService.set(key, '1', window)
        return next()
      }

      const currentCount = parseInt(count)

      // Verificar si se excedió el límite
      if (currentCount >= max) {
        logger.warn(`Rate limit excedido para usuario ${userId} en operación ${operation}`, {
          userId,
          operation,
          currentCount,
          maxAllowed: max
        })

        return res.status(429).json({
          success: false,
          message: `Has excedido el límite de ${max} ${operation} en ${window / 60} minutos. Intenta más tarde.`,
          retryAfter: Math.ceil(window / 60) // Minutos
        })
      }

      // Incrementar contador
      await redisService.incr(key)

      // Agregar headers informativos
      res.setHeader('X-RateLimit-Limit', max)
      res.setHeader('X-RateLimit-Remaining', max - currentCount - 1)
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + window)

      next()
    } catch (error) {
      logger.error(`Error en rate limiting por usuario (${operation}):`, error)
      // En caso de error, permitir la operación (fail-open para disponibilidad)
      next()
    }
  }
}

/**
 * Resetear contador de rate limit para un usuario (admin)
 * @param {string} userId - ID del usuario
 * @param {string} operation - Operación a resetear (opcional, si no se especifica, todas)
 */
export const resetRateLimitForUser = async (userId, operation = null) => {
  try {
    if (operation) {
      const key = `ratelimit:user:${userId}:${operation}`
      await redisService.del(key)
      logger.info(`Rate limit reseteado para usuario ${userId} en operación ${operation}`)
    } else {
      // Resetear todas las operaciones
      const pattern = `ratelimit:user:${userId}:*`
      const keys = await redisService.keys(pattern)
      await Promise.all(keys.map(key => redisService.del(key)))
      logger.info(`Todos los rate limits reseteados para usuario ${userId}`)
    }
  } catch (error) {
    logger.error('Error al resetear rate limit:', error)
  }
}

/**
 * Obtener estadísticas de rate limit para un usuario
 * @param {string} userId - ID del usuario
 * @returns {Promise<object>} Estadísticas
 */
export const getRateLimitStats = async (userId) => {
  try {
    const pattern = `ratelimit:user:${userId}:*`
    const keys = await redisService.keys(pattern)

    const stats = {}
    const keysData = await Promise.all(
      keys.map(async key => ({
        operation: key.split(':')[3],
        count: await redisService.get(key)
      }))
    )

    keysData.forEach(({ operation, count }) => {
      const limit = getLimitForOperation(operation)
      stats[operation] = {
        current: parseInt(count || '0'),
        max: limit.max,
        remaining: limit.max - parseInt(count || '0'),
        window: limit.window
      }
    })

    return stats
  } catch (error) {
    logger.error('Error al obtener estadísticas de rate limit:', error)
    return {}
  }
}

export default rateLimitByUser

