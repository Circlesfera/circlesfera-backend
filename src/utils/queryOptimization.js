/**
 * Utilidades para optimización de queries y evitar N+1
 * Incluye funciones helper para populate, agregaciones y joins optimizados
 */

import logger from './logger.js'

/**
 * Configuración estándar de populate para usuarios
 * Evita cargar campos innecesarios y mejora rendimiento
 */
export const USER_POPULATE_BASIC = {
  path: 'user',
  select: 'username avatar fullName isVerified'
}

export const USER_POPULATE_DETAILED = {
  path: 'user',
  select: 'username avatar fullName bio isVerified followers following'
}

/**
 * Populate para múltiples niveles (ej: comentarios con usuario)
 */
export const COMMENT_POPULATE = [
  {
    path: 'user',
    select: 'username avatar fullName isVerified'
  },
  {
    path: 'mentions',
    select: 'username'
  },
  {
    path: 'parentComment',
    select: 'content user',
    populate: {
      path: 'user',
      select: 'username avatar'
    }
  }
]

/**
 * Populate para posts con información completa
 */
export const POST_POPULATE = [
  {
    path: 'user',
    select: 'username avatar fullName isVerified'
  },
  {
    path: 'likes',
    select: 'username avatar',
    options: { limit: 3 } // Solo mostrar primeros 3 likes
  },
  {
    path: 'comments',
    options: { limit: 2 }, // Solo cargar primeros 2 comentarios
    populate: {
      path: 'user',
      select: 'username avatar'
    }
  }
]

/**
 * Pipeline de agregación para obtener posts con estadísticas
 * Evita N+1 al calcular likes y comments en una sola query
 */
export const getPostsWithStatsAggregation = (userId, options = {}) => {
  const {
    skip = 0,
    limit = 20,
    includeArchived = false,
    includeDeleted = false
  } = options

  return [
    // Match inicial
    {
      $match: {
        user: userId,
        ...(includeDeleted === false && { isDeleted: false }),
        ...(includeArchived === false && { isArchived: false })
      }
    },

    // Lookup para contar likes
    {
      $lookup: {
        from: 'users',
        localField: 'likes',
        foreignField: '_id',
        as: 'likeUsers'
      }
    },

    // Lookup para contar comments
    {
      $lookup: {
        from: 'comments',
        localField: '_id',
        foreignField: 'post',
        as: 'commentsList'
      }
    },

    // Agregar campos calculados
    {
      $addFields: {
        likesCount: { $size: '$likeUsers' },
        commentsCount: { $size: '$commentsList' }
      }
    },

    // Lookup para datos del usuario
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails'
      }
    },

    // Unwind user details
    {
      $unwind: {
        path: '$userDetails',
        preserveNullAndEmptyArrays: true
      }
    },

    // Proyectar solo campos necesarios
    {
      $project: {
        likeUsers: 0, // No enviar array completo de likes
        commentsList: 0, // No enviar array completo de comments
        'userDetails.password': 0,
        'userDetails.email': 0,
        'userDetails.phone': 0
      }
    },

    // Ordenar
    {
      $sort: { createdAt: -1 }
    },

    // Paginación
    {
      $skip: skip
    },
    {
      $limit: limit
    }
  ]
}

/**
 * Pipeline de agregación para feed de posts/reels
 * Incluye posts de usuarios seguidos con estadísticas
 */
export const getFeedAggregation = (userId, followingIds, options = {}) => {
  const {
    skip = 0,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options

  return [
    // Match posts de usuarios seguidos
    {
      $match: {
        user: { $in: followingIds },
        isPublic: true,
        isDeleted: false,
        isArchived: false
      }
    },

    // Lookup para contar likes
    {
      $addFields: {
        likesCount: { $size: '$likes' },
        isLikedByMe: { $in: [userId, '$likes'] }
      }
    },

    // Lookup para contar comentarios
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$post', '$$postId'] },
                  { $eq: ['$isDeleted', false] }
                ]
              }
            }
          },
          { $count: 'total' }
        ],
        as: 'commentsData'
      }
    },

    // Extraer count de comentarios
    {
      $addFields: {
        commentsCount: {
          $ifNull: [{ $arrayElemAt: ['$commentsData.total', 0] }, 0]
        }
      }
    },

    // Lookup para datos del usuario
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails'
      }
    },

    // Unwind user details
    {
      $unwind: '$userDetails'
    },

    // Proyectar
    {
      $project: {
        commentsData: 0,
        likes: 0, // No enviar array completo
        'userDetails.password': 0,
        'userDetails.email': 0
      }
    },

    // Ordenar
    {
      $sort: { [sortBy]: sortOrder }
    },

    // Paginación
    {
      $skip: skip
    },
    {
      $limit: limit
    }
  ]
}

/**
 * Pipeline para notificaciones con información de usuario
 */
export const getNotificationsAggregation = (userId, options = {}) => {
  const {
    skip = 0,
    limit = 20,
    type = null,
    unreadOnly = false
  } = options

  return [
    {
      $match: {
        user: userId,
        isDeleted: false,
        ...(type && { type }),
        ...(unreadOnly && { isRead: false })
      }
    },

    // Lookup para datos del usuario que generó la notificación
    {
      $lookup: {
        from: 'users',
        localField: 'fromUser',
        foreignField: '_id',
        as: 'fromUserDetails'
      }
    },

    {
      $unwind: {
        path: '$fromUserDetails',
        preserveNullAndEmptyArrays: true
      }
    },

    // Proyectar solo campos necesarios
    {
      $project: {
        'fromUserDetails.password': 0,
        'fromUserDetails.email': 0,
        'fromUserDetails.phone': 0,
        'fromUserDetails.following': 0,
        'fromUserDetails.followers': 0
      }
    },

    {
      $sort: { createdAt: -1 }
    },

    {
      $skip: skip
    },

    {
      $limit: limit
    }
  ]
}

/**
 * Helper para ejecutar agregación con manejo de errores
 */
export const executeAggregation = async (Model, pipeline, errorContext = 'Aggregation') => {
  try {
    const startTime = Date.now()
    const results = await Model.aggregate(pipeline)
    const duration = Date.now() - startTime

    logger.debug(`${errorContext} ejecutada en ${duration}ms`)

    return results
  } catch (error) {
    logger.error(`Error en ${errorContext}:`, error)
    throw error
  }
}

/**
 * Batch loader para evitar N+1 al cargar usuarios
 * Útil con DataLoader o manualmente
 */
export class UserBatchLoader {
  constructor() {
    this.cache = new Map()
    this.queue = []
  }

  /**
   * Agregar ID a la cola para batch loading
   */
  load(userId) {
    return new Promise((resolve, reject) => {
      // Si ya está en caché, devolver inmediatamente
      if (this.cache.has(userId.toString())) {
        resolve(this.cache.get(userId.toString()))
        return
      }

      // Agregar a la cola
      this.queue.push({ userId, resolve, reject })

      // Si es el primer item, programar batch
      if (this.queue.length === 1) {
        process.nextTick(() => this.executeBatch())
      }
    })
  }

  /**
   * Ejecutar batch de queries
   */
  async executeBatch() {
    const currentQueue = this.queue.splice(0)
    const userIds = currentQueue.map(item => item.userId)

    try {
      // Cargar todos los usuarios en una query
      const User = (await import('../models/User.js')).default
      const users = await User.find({
        _id: { $in: userIds }
      }).select('username avatar fullName isVerified').lean()

      // Crear mapa de resultados
      const userMap = new Map()
      users.forEach(user => {
        userMap.set(user._id.toString(), user)
        this.cache.set(user._id.toString(), user)
      })

      // Resolver promesas
      currentQueue.forEach(({ userId, resolve }) => {
        resolve(userMap.get(userId.toString()) || null)
      })
    } catch (error) {
      logger.error('Error en batch loading de usuarios:', error)
      currentQueue.forEach(({ reject }) => reject(error))
    }
  }

  /**
   * Limpiar caché
   */
  clearCache() {
    this.cache.clear()
  }
}

