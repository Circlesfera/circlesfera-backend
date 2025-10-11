/**
 * Middleware de Invalidación Inteligente de Caché
 * Fase 2: Performance Crítico
 *
 * Se ejecuta después de operaciones exitosas para invalidar caché relevante
 */

import cacheService from '../services/cacheService.js'
import logger from '../utils/logger.js'
import User from '../models/User.js'

/**
 * Invalidar caché de perfil de usuario
 * Usar después de: update profile, follow/unfollow, etc.
 */
export const invalidateUserProfile = async (req, res, next) => {
  try {
    const username = req.user?.username || req.params.username
    if (username) {
      await cacheService.invalidateUserProfile(username)
      logger.debug('Caché de perfil invalidado:', { username })
    }
  } catch (error) {
    logger.error('Error al invalidar caché de perfil:', error)
  }
  next()
}

/**
 * Invalidar caché de feeds
 * Usar después de: crear post/reel/story, follow/unfollow
 */
export const invalidateFeeds = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.userId

    if (userId) {
      // Invalidar feed del usuario actual
      await cacheService.invalidateFeed(userId)
      logger.debug('Caché de feed invalidado:', { userId })
    }
  } catch (error) {
    logger.error('Error al invalidar caché de feeds:', error)
  }
  next()
}

/**
 * Invalidar feeds de todos los seguidores
 * Usar después de: crear post/reel/story (nuevo contenido)
 */
export const invalidateFollowersFeeds = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.userId

    if (userId) {
      // Obtener lista de seguidores
      const user = await User.findById(userId).select('followers').lean()

      if (user && user.followers && user.followers.length > 0) {
        // Invalidar feeds de todos los seguidores
        const followerIds = user.followers.map(id => id.toString())
        const deletedCount = await cacheService.invalidateFollowersFeeds(followerIds)
        logger.info('Caché de feeds de seguidores invalidado:', {
          userId,
          followers: followerIds.length,
          deleted: deletedCount
        })
      }
    }
  } catch (error) {
    logger.error('Error al invalidar caché de feeds de seguidores:', error)
  }
  next()
}

/**
 * Invalidar caché de stories
 * Usar después de: crear story, eliminar story
 */
export const invalidateStories = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.userId

    if (userId) {
      await cacheService.invalidateStories(userId)
      logger.debug('Caché de stories invalidado:', { userId })
    }
  } catch (error) {
    logger.error('Error al invalidar caché de stories:', error)
  }
  next()
}

/**
 * Invalidar caché de post específico
 * Usar después de: update post, like post, comment post, delete post
 */
export const invalidatePost = async (req, res, next) => {
  try {
    const postId = req.params.id || req.params.postId

    if (postId) {
      await cacheService.invalidatePost(postId)
      logger.debug('Caché de post invalidado:', { postId })
    }
  } catch (error) {
    logger.error('Error al invalidar caché de post:', error)
  }
  next()
}

/**
 * Invalidar trending (posts y reels)
 * Usar después de: acciones que afecten trending (muchos likes, etc.)
 */
export const invalidateTrending = async (req, res, next) => {
  try {
    await cacheService.del(cacheService.KEYS.TRENDING_POSTS)
    await cacheService.del(cacheService.KEYS.TRENDING_REELS)
    logger.debug('Caché de trending invalidado')
  } catch (error) {
    logger.error('Error al invalidar caché de trending:', error)
  }
  next()
}

/**
 * Invalidar múltiples tipos de caché a la vez
 * @param {Array<string>} types - Tipos de caché a invalidar: ['profile', 'feed', 'stories', 'post', 'trending']
 * @returns {Function} Middleware
 */
export const invalidateMultiple = (types = []) => async (req, res, next) => {
  try {
    const promises = []

    if (types.includes('profile')) {
      const username = req.user?.username || req.params.username
      if (username) {
        promises.push(cacheService.invalidateUserProfile(username))
      }
    }

    if (types.includes('feed')) {
      const userId = req.user?._id || req.userId
      if (userId) {
        promises.push(cacheService.invalidateFeed(userId))
      }
    }

    if (types.includes('feedFollowers')) {
      const userId = req.user?._id || req.userId
      if (userId) {
        const user = await User.findById(userId).select('followers').lean()
        if (user?.followers) {
          const followerIds = user.followers.map(id => id.toString())
          promises.push(cacheService.invalidateFollowersFeeds(followerIds))
        }
      }
    }

    if (types.includes('stories')) {
      const userId = req.user?._id || req.userId
      if (userId) {
        promises.push(cacheService.invalidateStories(userId))
      }
    }

    if (types.includes('post')) {
      const postId = req.params.id || req.params.postId
      if (postId) {
        promises.push(cacheService.invalidatePost(postId))
      }
    }

    if (types.includes('trending')) {
      promises.push(cacheService.del(cacheService.KEYS.TRENDING_POSTS))
      promises.push(cacheService.del(cacheService.KEYS.TRENDING_REELS))
    }

    await Promise.all(promises)
    logger.debug('Caché múltiple invalidado:', { types })
  } catch (error) {
    logger.error('Error al invalidar caché múltiple:', error)
  }
  next()
}

/**
 * Helper para invalidar caché en respuesta exitosa
 * Solo invalida si la operación fue exitosa (status 2xx)
 */
export const invalidateOnSuccess = (invalidationFn) => (req, res, next) => {
  // Interceptar res.json para detectar respuesta exitosa
  const originalJson = res.json.bind(res)

  res.json = function (data) {
    // Si la respuesta es exitosa, invalidar caché
    if (data.success === true || (res.statusCode >= 200 && res.statusCode < 300)) {
      invalidationFn(req, res, () => { }).catch(error => {
        logger.error('Error en invalidación de caché:', error)
      })
    }

    return originalJson(data)
  }

  next()
}

export default {
  invalidateUserProfile,
  invalidateFeeds,
  invalidateFollowersFeeds,
  invalidateStories,
  invalidatePost,
  invalidateTrending,
  invalidateMultiple,
  invalidateOnSuccess
}

