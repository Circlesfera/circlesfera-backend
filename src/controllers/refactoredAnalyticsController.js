import BaseController from './BaseController.js'
import AnalyticsEvent from '../models/AnalyticsEvent.js'
import User from '../models/User.js'
import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import Story from '../models/Story.js'
import LiveStream from '../models/LiveStream.js'
import Report from '../models/Report.js'
import Message from '../models/Message.js'
import { body, param, query } from 'express-validator'
import logger from '../utils/logger.js'
import {
  createPaginatedResponse,
  getPaginationOptions,
  USER_BASIC_FIELDS
} from '../utils/queryOptimizer.js'

/**
 * Controlador refactorizado para Analytics
 * Extiende BaseController para consistencia arquitectónica
 */
class RefactoredAnalyticsController extends BaseController {
  constructor() {
    super()
    this.model = AnalyticsEvent
    this.modelName = 'AnalyticsEvent'

    // Configurar reglas de validación
    this.setupValidationRules()
  }

  /**
   * Configurar reglas de validación para todos los métodos
   */
  setupValidationRules() {
    this.validationRules = {
      trackEvent: [
        body('event')
          .notEmpty()
          .withMessage('El evento es requerido')
          .isString()
          .withMessage('El evento debe ser texto'),
        body('category')
          .optional()
          .isString()
          .withMessage('La categoría debe ser texto'),
        body('action')
          .optional()
          .isString()
          .withMessage('La acción debe ser texto'),
        body('label')
          .optional()
          .isString()
          .withMessage('La etiqueta debe ser texto'),
        body('value')
          .optional()
          .isNumeric()
          .withMessage('El valor debe ser numérico'),
        body('metadata')
          .optional()
          .isObject()
          .withMessage('Los metadatos deben ser un objeto'),
        body('sessionId')
          .optional()
          .isString()
          .withMessage('El sessionId debe ser texto')
      ],
      getEvents: [
        query('page')
          .optional()
          .isInt({ min: 1 })
          .withMessage('La página debe ser un número entero mayor a 0'),
        query('limit')
          .optional()
          .isInt({ min: 1, max: 100 })
          .withMessage('El límite debe estar entre 1 y 100'),
        query('event')
          .optional()
          .isString()
          .withMessage('El evento debe ser texto'),
        query('category')
          .optional()
          .isString()
          .withMessage('La categoría debe ser texto'),
        query('startDate')
          .optional()
          .isISO8601()
          .withMessage('La fecha de inicio debe ser válida'),
        query('endDate')
          .optional()
          .isISO8601()
          .withMessage('La fecha de fin debe ser válida')
      ],
      getUserAnalytics: [
        param('userId')
          .isMongoId()
          .withMessage('ID de usuario inválido'),
        query('startDate')
          .optional()
          .isISO8601()
          .withMessage('La fecha de inicio debe ser válida'),
        query('endDate')
          .optional()
          .isISO8601()
          .withMessage('La fecha de fin debe ser válida')
      ],
      getContentAnalytics: [
        query('contentType')
          .isIn(['post', 'reel', 'story', 'livestream'])
          .withMessage('El tipo de contenido debe ser post, reel, story o livestream'),
        query('startDate')
          .optional()
          .isISO8601()
          .withMessage('La fecha de inicio debe ser válida'),
        query('endDate')
          .optional()
          .isISO8601()
          .withMessage('La fecha de fin debe ser válida')
      ]
    }
  }

  /**
   * Registrar evento de analytics
   */
  async trackEvent(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { event, category, action, label, value, metadata, sessionId } = req.body

      // Obtener información adicional del request
      const eventData = {
        event,
        category,
        action,
        label,
        value,
        metadata,
        sessionId,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        language: req.get('accept-language'),
        referrer: req.get('referer'),
        timestamp: new Date()
      }

      // Si el usuario está autenticado, agregar su ID
      if (req.user && req.user.id) {
        eventData.user = req.user.id
      }

      // Guardar evento
      try {
        await AnalyticsEvent.create(eventData)
      } catch (err) {
        logger.error('Error guardando evento de analytics:', err)
      }

      // Responder inmediatamente
      return res.status(204).send()

    } catch (error) {
      logger.error('❌ Error en trackEvent:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener eventos de analytics
   */
  async getEvents(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const {
        page = 1,
        limit = 50,
        event,
        category,
        startDate,
        endDate
      } = req.query

      const paginationOptions = getPaginationOptions(page, limit)

      // Construir query
      const query = {}
      if (event) {
        query.event = event
      }
      if (category) {
        query.category = category
      }
      if (startDate || endDate) {
        query.timestamp = {}
        if (startDate) {
          query.timestamp.$gte = new Date(startDate)
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate)
        }
      }

      const events = await AnalyticsEvent.find(query)
        .populate('user', USER_BASIC_FIELDS)
        .sort({ timestamp: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await AnalyticsEvent.countDocuments(query)

      const response = createPaginatedResponse(events, total, page, limit)

      return this.sendSuccess(res, response, 'Eventos obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getEvents:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener analytics de un usuario específico
   */
  async getUserAnalytics(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { userId } = req.params
      const { startDate, endDate } = req.query

      // Verificar que el usuario existe
      const user = await User.findById(userId)
      if (!user) {
        return this.sendError(res, 'Usuario no encontrado', 404)
      }

      // Construir query de fechas
      const dateQuery = {}
      if (startDate || endDate) {
        dateQuery.timestamp = {}
        if (startDate) {
          dateQuery.timestamp.$gte = new Date(startDate)
        }
        if (endDate) {
          dateQuery.timestamp.$lte = new Date(endDate)
        }
      }

      // Obtener eventos del usuario
      const events = await AnalyticsEvent.find({
        user: userId,
        ...dateQuery
      }).sort({ timestamp: -1 })

      // Obtener estadísticas de contenido del usuario
      const [posts, reels, stories, liveStreams] = await Promise.all([
        Post.countDocuments({ userId, ...dateQuery }),
        Reel.countDocuments({ userId, ...dateQuery }),
        Story.countDocuments({ userId, ...dateQuery }),
        LiveStream.countDocuments({ user: userId, ...dateQuery })
      ])

      // Calcular métricas de engagement
      const totalLikes = await Post.aggregate([
        { $match: { userId, ...dateQuery } },
        { $group: { _id: null, total: { $sum: { $size: '$likes' } } } }
      ])

      const totalComments = await Post.aggregate([
        { $match: { userId, ...dateQuery } },
        { $group: { _id: null, total: { $sum: { $size: '$comments' } } } }
      ])

      const analytics = {
        user: {
          id: user._id,
          username: user.username,
          fullName: user.fullName
        },
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        content: {
          posts,
          reels,
          stories,
          liveStreams,
          total: posts + reels + stories + liveStreams
        },
        engagement: {
          totalLikes: totalLikes[0]?.total || 0,
          totalComments: totalComments[0]?.total || 0,
          totalEvents: events.length
        },
        events: events.slice(0, 100) // Últimos 100 eventos
      }

      return this.sendSuccess(res, analytics, 'Analytics del usuario obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getUserAnalytics:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener analytics de contenido
   */
  async getContentAnalytics(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { contentType, startDate, endDate } = req.query

      // Construir query de fechas
      const dateQuery = {}
      if (startDate || endDate) {
        const dateField = contentType === 'livestream' ? 'startTime' : 'createdAt'
        dateQuery[dateField] = {}
        if (startDate) {
          dateQuery[dateField].$gte = new Date(startDate)
        }
        if (endDate) {
          dateQuery[dateField].$lte = new Date(endDate)
        }
      }

      let analytics = {}

      switch (contentType) {
        case 'post':
          analytics = await this.getPostAnalytics(dateQuery)
          break
        case 'reel':
          analytics = await this.getReelAnalytics(dateQuery)
          break
        case 'story':
          analytics = await this.getStoryAnalytics(dateQuery)
          break
        case 'livestream':
          analytics = await this.getLiveStreamAnalytics(dateQuery)
          break
        default:
          return this.sendError(res, 'Tipo de contenido no válido', 400)
      }

      return this.sendSuccess(res, analytics, 'Analytics de contenido obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getContentAnalytics:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener analytics de posts
   */
  async getPostAnalytics(dateQuery) {
    const [
      totalPosts,
      totalLikes,
      totalComments,
      totalViews,
      topPosts
    ] = await Promise.all([
      Post.countDocuments(dateQuery),
      Post.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: { $size: '$likes' } } } }
      ]),
      Post.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: { $size: '$comments' } } } }
      ]),
      Post.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]),
      Post.find(dateQuery)
        .populate('userId', USER_BASIC_FIELDS)
        .sort({ views: -1 })
        .limit(10)
    ])

    return {
      contentType: 'post',
      metrics: {
        totalPosts,
        totalLikes: totalLikes[0]?.total || 0,
        totalComments: totalComments[0]?.total || 0,
        totalViews: totalViews[0]?.total || 0
      },
      topContent: topPosts
    }
  }

  /**
   * Obtener analytics de reels
   */
  async getReelAnalytics(dateQuery) {
    const [
      totalReels,
      totalLikes,
      totalComments,
      totalViews,
      topReels
    ] = await Promise.all([
      Reel.countDocuments(dateQuery),
      Reel.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: { $size: '$likes' } } } }
      ]),
      Reel.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: { $size: '$comments' } } } }
      ]),
      Reel.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]),
      Reel.find(dateQuery)
        .populate('userId', USER_BASIC_FIELDS)
        .sort({ views: -1 })
        .limit(10)
    ])

    return {
      contentType: 'reel',
      metrics: {
        totalReels,
        totalLikes: totalLikes[0]?.total || 0,
        totalComments: totalComments[0]?.total || 0,
        totalViews: totalViews[0]?.total || 0
      },
      topContent: topReels
    }
  }

  /**
   * Obtener analytics de stories
   */
  async getStoryAnalytics(dateQuery) {
    const [
      totalStories,
      totalViews,
      topStories
    ] = await Promise.all([
      Story.countDocuments(dateQuery),
      Story.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: { $size: '$views' } } } }
      ]),
      Story.find(dateQuery)
        .populate('userId', USER_BASIC_FIELDS)
        .sort({ 'views': -1 })
        .limit(10)
    ])

    return {
      contentType: 'story',
      metrics: {
        totalStories,
        totalViews: totalViews[0]?.total || 0
      },
      topContent: topStories
    }
  }

  /**
   * Obtener analytics de live streams
   */
  async getLiveStreamAnalytics(dateQuery) {
    const [
      totalLiveStreams,
      totalViewers,
      totalDuration,
      topLiveStreams
    ] = await Promise.all([
      LiveStream.countDocuments(dateQuery),
      LiveStream.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: '$totalViewers' } } }
      ]),
      LiveStream.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, total: { $sum: '$duration' } } }
      ]),
      LiveStream.find(dateQuery)
        .populate('user', USER_BASIC_FIELDS)
        .sort({ totalViewers: -1 })
        .limit(10)
    ])

    return {
      contentType: 'livestream',
      metrics: {
        totalLiveStreams,
        totalViewers: totalViewers[0]?.total || 0,
        totalDuration: totalDuration[0]?.total || 0
      },
      topContent: topLiveStreams
    }
  }

  /**
   * Obtener métricas generales de la plataforma
   */
  async getPlatformMetrics(req, res) {
    try {
      const { startDate, endDate } = req.query

      // Construir query de fechas
      const dateQuery = {}
      if (startDate || endDate) {
        dateQuery.createdAt = {}
        if (startDate) {
          dateQuery.createdAt.$gte = new Date(startDate)
        }
        if (endDate) {
          dateQuery.createdAt.$lte = new Date(endDate)
        }
      }

      const [
        totalUsers,
        totalPosts,
        totalReels,
        totalStories,
        totalLiveStreams,
        totalMessages,
        totalReports
      ] = await Promise.all([
        User.countDocuments(dateQuery),
        Post.countDocuments(dateQuery),
        Reel.countDocuments(dateQuery),
        Story.countDocuments(dateQuery),
        LiveStream.countDocuments(dateQuery),
        Message.countDocuments(dateQuery),
        Report.countDocuments(dateQuery)
      ])

      const metrics = {
        users: {
          total: totalUsers,
          active: await User.countDocuments({
            ...dateQuery,
            lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          })
        },
        content: {
          posts: totalPosts,
          reels: totalReels,
          stories: totalStories,
          liveStreams: totalLiveStreams,
          total: totalPosts + totalReels + totalStories + totalLiveStreams
        },
        engagement: {
          messages: totalMessages,
          reports: totalReports
        },
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }

      return this.sendSuccess(res, metrics, 'Métricas de la plataforma obtenidas exitosamente')

    } catch (error) {
      logger.error('❌ Error en getPlatformMetrics:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener eventos más frecuentes
   */
  async getTopEvents(req, res) {
    try {
      const { limit = 10, startDate, endDate } = req.query

      // Construir query de fechas
      const dateQuery = {}
      if (startDate || endDate) {
        dateQuery.timestamp = {}
        if (startDate) {
          dateQuery.timestamp.$gte = new Date(startDate)
        }
        if (endDate) {
          dateQuery.timestamp.$lte = new Date(endDate)
        }
      }

      const topEvents = await AnalyticsEvent.aggregate([
        { $match: dateQuery },
        { $group: { _id: '$event', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(limit) }
      ])

      return this.sendSuccess(res, topEvents, 'Eventos más frecuentes obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getTopEvents:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }
}

// Crear instancia del controlador
const analyticsController = new RefactoredAnalyticsController()

// Exportar métodos como funciones individuales para compatibilidad con rutas
export const {
  trackEvent,
  getEvents,
  getUserAnalytics,
  getContentAnalytics,
  getPlatformMetrics,
  getTopEvents
} = analyticsController

// Exportar también la clase para testing
export { RefactoredAnalyticsController, analyticsController }
