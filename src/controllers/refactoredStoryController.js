/**
 * 📝 REFACTORED STORY CONTROLLER
 * ==============================
 * Controlador de historias refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import Story from '../models/Story.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { config } from '../utils/config.js'
import logger from '../utils/logger.js'
import cacheService from '../services/cacheService.js'
import notificationService from '../services/notificationService.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class StoryController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para crear historia
  static createStoryValidations = [
    body('type')
      .isIn(['image', 'video', 'text'])
      .withMessage('El tipo debe ser image, video o text'),
    body('caption')
      .optional()
      .isLength({ max: 2200 })
      .withMessage('La descripción no puede exceder 2200 caracteres'),
    body('location')
      .optional()
      .isLength({ max: 100 })
      .withMessage('La ubicación no puede exceder 100 caracteres'),
    body('textContent')
      .optional()
      .isLength({ max: 500 })
      .withMessage('El contenido de texto no puede exceder 500 caracteres')
  ]

  // Crear una nueva historia
  async createStory(req, res) {
    try {
      const { type, caption, location, textContent, textStyle } = req.body

      const storyData = {
        user: req.user.id,
        type: type || 'image',
        caption: caption || ''
      }

      // Agregar ubicación si se proporciona
      if (location) {
        storyData.location = { name: location }
      }

      // Obtener la URL base del servidor
      const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`

      // Manejar diferentes tipos de contenido
      switch (type) {
        case 'image':
          if (!req.files || !req.files.image) {
            return this.sendError(res, 'La imagen es obligatoria para historias de imagen', 400)
          }

          storyData.content = {
            image: {
              url: `${baseUrl}/uploads/${req.files.image[0].filename}`,
              alt: caption || '',
              width: 0,
              height: 0
            }
          }
          break

        case 'video':
          if (!req.files || !req.files.video) {
            return this.sendError(res, 'El video es obligatorio para historias de video', 400)
          }

          storyData.content = {
            video: {
              url: `${baseUrl}/uploads/${req.files.video[0].filename}`,
              duration: 0,
              thumbnail: `${baseUrl}/uploads/${req.files.video[0].filename.replace(/\.[^/.]+$/, '_thumb.jpg')}`,
              width: 0,
              height: 0
            }
          }
          break

        case 'text':
          if (!textContent) {
            return this.sendError(res, 'El contenido de texto es obligatorio para historias de texto', 400)
          }

          storyData.content = {
            text: {
              content: textContent,
              style: textStyle || {
                backgroundColor: '#000000',
                textColor: '#FFFFFF',
                fontFamily: 'Arial',
                fontSize: 24
              }
            }
          }
          break

        default:
          return this.sendError(res, 'Tipo de historia no válido', 400)
      }

      // Crear la historia
      const story = new Story(storyData)
      await story.save()

      // Invalidar caché de historias del usuario
      await cacheService.invalidateUserStories(req.user.id)

      // Enviar notificación a seguidores
      await notificationService.notifyNewStory(req.user, story)

      logger.info('Historia creada exitosamente', {
        storyId: story._id,
        userId: req.user.id,
        type: story.type
      })

      return this.sendSuccess(res, story, 'Historia creada exitosamente', 201)

    } catch (error) {
      return this.handleError(error, res, 'createStory', {
        userId: req.user?.id,
        type: req.body?.type
      })
    }
  }

  // Obtener historias del usuario
  async getUserStories(req, res) {
    try {
      const { username } = req.params
      const { includeExpired = false } = req.query

      // Buscar usuario por username
      const user = await User.findOne({ username: username.toLowerCase() })
      if (!user) {
        return this.sendError(res, 'Usuario no encontrado', 404)
      }

      // Intentar obtener del caché
      const cacheKey = `stories:${user._id}:${includeExpired ? 'all' : 'active'}`
      const cachedStories = await cacheService.get(cacheKey)

      if (cachedStories) {
        return this.sendSuccess(res, cachedStories, 'Historias obtenidas del caché')
      }

      // Construir query
      const query = { user: user._id }
      if (!includeExpired) {
        query.expiresAt = { $gt: new Date() }
      }

      // Obtener historias
      const stories = await Story.find(query)
        .populate('user', 'username avatar fullName')
        .sort({ createdAt: -1 })
        .lean()

      // Cachear por 5 minutos
      await cacheService.set(cacheKey, stories, 300)

      return this.sendSuccess(res, stories, 'Historias obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getUserStories', {
        username: req.params?.username
      })
    }
  }

  // Obtener feed de historias
  async getStoriesFeed(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query
      const skip = (page - 1) * limit

      // Intentar obtener del caché
      const cacheKey = `stories:feed:${req.user.id}:${page}:${limit}`
      const cachedFeed = await cacheService.get(cacheKey)

      if (cachedFeed) {
        return this.sendSuccess(res, cachedFeed, 'Feed de historias obtenido del caché')
      }

      // Obtener usuarios seguidos
      const following = await User.findById(req.user.id)
        .select('following')
        .lean()

      const followingIds = following?.following || []

      // Obtener historias activas de usuarios seguidos
      const stories = await Story.find({
        user: { $in: followingIds },
        expiresAt: { $gt: new Date() }
      })
        .populate('user', 'username avatar fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()

      // Agrupar por usuario
      const groupedStories = stories.reduce((acc, story) => {
        const userId = story.user._id.toString()
        if (!acc[userId]) {
          acc[userId] = {
            user: story.user,
            stories: []
          }
        }
        acc[userId].stories.push(story)
        return acc
      }, {})

      const feedData = {
        stories: Object.values(groupedStories),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: stories.length === parseInt(limit)
        }
      }

      // Cachear por 2 minutos
      await cacheService.set(cacheKey, feedData, 120)

      return this.sendSuccess(res, feedData, 'Feed de historias obtenido exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getStoriesFeed', {
        userId: req.user?.id
      })
    }
  }

  // Ver una historia específica
  async viewStory(req, res) {
    try {
      const { storyId } = req.params

      const story = await Story.findById(storyId)
        .populate('user', 'username avatar fullName')
        .lean()

      if (!story) {
        return this.sendError(res, 'Historia no encontrada', 404)
      }

      // Verificar si la historia ha expirado
      if (story.expiresAt < new Date()) {
        return this.sendError(res, 'Esta historia ha expirado', 410)
      }

      // Registrar visualización
      await Story.findByIdAndUpdate(storyId, {
        $addToSet: { views: req.user.id }
      })

      return this.sendSuccess(res, story, 'Historia obtenida exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'viewStory', {
        storyId: req.params?.storyId,
        userId: req.user?.id
      })
    }
  }

  // Eliminar una historia
  async deleteStory(req, res) {
    try {
      const { storyId } = req.params

      const story = await Story.findById(storyId)
      if (!story) {
        return this.sendError(res, 'Historia no encontrada', 404)
      }

      // Verificar que el usuario es el propietario
      if (story.user.toString() !== req.user.id) {
        return this.sendError(res, 'No tienes permisos para eliminar esta historia', 403)
      }

      await Story.findByIdAndDelete(storyId)

      // Invalidar caché
      await cacheService.invalidateUserStories(req.user.id)

      logger.info('Historia eliminada', {
        storyId,
        userId: req.user.id
      })

      return this.sendSuccess(res, null, 'Historia eliminada exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'deleteStory', {
        storyId: req.params?.storyId,
        userId: req.user?.id
      })
    }
  }

  // Obtener estadísticas de historias
  async getStoryStats(req, res) {
    try {
      const { storyId } = req.params

      const story = await Story.findById(storyId)
        .select('views createdAt expiresAt')
        .lean()

      if (!story) {
        return this.sendError(res, 'Historia no encontrada', 404)
      }

      const stats = {
        views: story.views?.length || 0,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        isExpired: story.expiresAt < new Date()
      }

      return this.sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getStoryStats', {
        storyId: req.params?.storyId
      })
    }
  }
}

// Crear instancia del controlador
const storyController = new StoryController()

export { storyController, StoryController }
