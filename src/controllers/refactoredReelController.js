import BaseController from './BaseController.js'
import Reel from '../models/Reel.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { body, param, query } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import { config } from '../utils/config.js'
import {
  createPaginatedResponse,
  getPaginationOptions,
  USER_BASIC_FIELDS
} from '../utils/queryOptimizer.js'

/**
 * Controlador refactorizado para Reels
 * Extiende BaseController para consistencia arquitectónica
 */
class RefactoredReelController extends BaseController {
  constructor() {
    super()
    this.model = Reel
    this.modelName = 'Reel'

    // Configurar reglas de validación
    this.setupValidationRules()
  }

  /**
   * Configurar reglas de validación para todos los métodos
   */
  setupValidationRules() {
    this.validationRules = {
      createReel: [
        body('caption')
          .optional()
          .isLength({ max: 2200 })
          .withMessage('La descripción no puede exceder 2200 caracteres'),
        body('hashtags')
          .optional()
          .isArray()
          .withMessage('Los hashtags deben ser un array'),
        body('location')
          .optional()
          .isObject()
          .withMessage('La ubicación debe ser un objeto'),
        body('audioTitle')
          .optional()
          .isString()
          .withMessage('El título del audio debe ser texto'),
        body('audioArtist')
          .optional()
          .isString()
          .withMessage('El artista del audio debe ser texto'),
        body('allowComments')
          .optional()
          .isBoolean()
          .withMessage('allowComments debe ser booleano'),
        body('allowDuets')
          .optional()
          .isBoolean()
          .withMessage('allowDuets debe ser booleano'),
        body('allowStitches')
          .optional()
          .isBoolean()
          .withMessage('allowStitches debe ser booleano')
      ],
      getReel: [
        param('id')
          .isMongoId()
          .withMessage('ID de reel inválido')
      ],
      updateReel: [
        param('id')
          .isMongoId()
          .withMessage('ID de reel inválido'),
        body('caption')
          .optional()
          .isLength({ max: 2200 })
          .withMessage('La descripción no puede exceder 2200 caracteres'),
        body('hashtags')
          .optional()
          .isArray()
          .withMessage('Los hashtags deben ser un array')
      ],
      deleteReel: [
        param('id')
          .isMongoId()
          .withMessage('ID de reel inválido')
      ],
      likeReel: [
        param('id')
          .isMongoId()
          .withMessage('ID de reel inválido')
      ],
      getReelsFeed: [
        query('page')
          .optional()
          .isInt({ min: 1 })
          .withMessage('La página debe ser un número entero mayor a 0'),
        query('limit')
          .optional()
          .isInt({ min: 1, max: 50 })
          .withMessage('El límite debe estar entre 1 y 50')
      ],
      getUserReels: [
        param('userId')
          .isMongoId()
          .withMessage('ID de usuario inválido'),
        query('page')
          .optional()
          .isInt({ min: 1 })
          .withMessage('La página debe ser un número entero mayor a 0'),
        query('limit')
          .optional()
          .isInt({ min: 1, max: 50 })
          .withMessage('El límite debe estar entre 1 y 50')
      ],
      searchReels: [
        query('q')
          .notEmpty()
          .withMessage('El término de búsqueda es requerido'),
        query('page')
          .optional()
          .isInt({ min: 1 })
          .withMessage('La página debe ser un número entero mayor a 0'),
        query('limit')
          .optional()
          .isInt({ min: 1, max: 50 })
          .withMessage('El límite debe estar entre 1 y 50')
      ]
    }
  }

  /**
   * Crear un nuevo reel
   */
  async createReel(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      logger.info('🎬 createReel llamado con:', {
        userId: req.user.id,
        body: req.body,
        headers: req.headers
      })

      const {
        caption,
        hashtags,
        location,
        audioTitle,
        audioArtist,
        allowComments = true,
        allowDuets = true,
        allowStitches = true
      } = req.body

      // Verificar que se subió un video
      if (!req.files || !req.files.video) {
        return this.sendError(res, 'El video es obligatorio para crear un reel', 400)
      }

      const videoFile = req.files.video[0]

      // Validar tipo de archivo
      if (!videoFile.mimetype.startsWith('video/')) {
        return this.sendError(res, 'El archivo debe ser un video', 400)
      }

      // Validar tamaño del archivo (máximo 100MB)
      const maxSize = 100 * 1024 * 1024 // 100MB
      if (videoFile.size > maxSize) {
        return this.sendError(res, 'El video es demasiado grande (máximo 100MB)', 400)
      }

      // Crear el reel
      const reelData = {
        userId: req.user.id,
        caption: caption || '',
        videoUrl: videoFile.filename,
        hashtags: hashtags || [],
        location: location || null,
        audioTitle: audioTitle || null,
        audioArtist: audioArtist || null,
        allowComments,
        allowDuets,
        allowStitches,
        duration: 0, // Se calculará después
        views: 0,
        likes: [],
        comments: [],
        shares: 0
      }

      const reel = new Reel(reelData)
      await reel.save()

      // Actualizar contador de reels del usuario
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { reelCount: 1 }
      })

      // Enviar notificación a seguidores
      await this.notifyFollowersNewReel(req.user.id, reel._id)

      // Limpiar cache del feed
      await cache.del(`feed:${req.user.id}:*`)

      logger.info('✅ Reel creado exitosamente:', {
        reelId: reel._id,
        userId: req.user.id
      })

      return this.sendSuccess(res, reel, 'Reel creado exitosamente', 201)

    } catch (error) {
      logger.error('❌ Error en createReel:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener un reel específico
   */
  async getReel(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params

      const reel = await Reel.findById(id)
        .populate('userId', USER_BASIC_FIELDS)
        .populate('likes.userId', USER_BASIC_FIELDS)
        .populate({
          path: 'comments.userId',
          select: USER_BASIC_FIELDS
        })

      if (!reel) {
        return this.sendError(res, 'Reel no encontrado', 404)
      }

      // Incrementar vistas
      await Reel.findByIdAndUpdate(id, { $inc: { views: 1 } })

      return this.sendSuccess(res, reel, 'Reel obtenido exitosamente')

    } catch (error) {
      logger.error('❌ Error en getReel:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Actualizar un reel
   */
  async updateReel(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params
      const { caption, hashtags } = req.body

      const reel = await Reel.findById(id)
      if (!reel) {
        return this.sendError(res, 'Reel no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (reel.userId.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para editar este reel', 403)
      }

      const updateData = {}
      if (caption !== undefined) {
        updateData.caption = caption
      }
      if (hashtags !== undefined) {
        updateData.hashtags = hashtags
      }

      const updatedReel = await Reel.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).populate('userId', USER_BASIC_FIELDS)

      return this.sendSuccess(res, updatedReel, 'Reel actualizado exitosamente')

    } catch (error) {
      logger.error('❌ Error en updateReel:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Eliminar un reel
   */
  async deleteReel(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params

      const reel = await Reel.findById(id)
      if (!reel) {
        return this.sendError(res, 'Reel no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (reel.userId.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para eliminar este reel', 403)
      }

      await Reel.findByIdAndDelete(id)

      // Actualizar contador de reels del usuario
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { reelCount: -1 }
      })

      // Limpiar cache
      await cache.del(`feed:${req.user.id}:*`)

      return this.sendSuccess(res, null, 'Reel eliminado exitosamente')

    } catch (error) {
      logger.error('❌ Error en deleteReel:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Like/Unlike a un reel
   */
  async likeReel(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params
      const userId = req.user.id

      const reel = await Reel.findById(id)
      if (!reel) {
        return this.sendError(res, 'Reel no encontrado', 404)
      }

      const existingLike = reel.likes.find(like => like.userId.toString() === userId)

      if (existingLike) {
        // Unlike
        reel.likes = reel.likes.filter(like => like.userId.toString() !== userId)
        await reel.save()

        return this.sendSuccess(res, { liked: false }, 'Like removido exitosamente')
      }

      // Like
      reel.likes.push({ userId, createdAt: new Date() })
      await reel.save()

      // Enviar notificación al propietario del reel
      if (reel.userId.toString() !== userId) {
        await this.sendLikeNotification(reel.userId, userId, id, 'reel')
      }

      return this.sendSuccess(res, { liked: true }, 'Like agregado exitosamente')

    } catch (error) {
      logger.error('❌ Error en likeReel:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener feed de reels
   */
  async getReelsFeed(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { page = 1, limit = 20 } = req.query
      const paginationOptions = getPaginationOptions(page, limit)

      // Obtener usuarios seguidos
      const user = await User.findById(req.user.id).populate('following.userId')
      const followingIds = user.following.map(follow => follow.userId._id)
      followingIds.push(req.user.id) // Incluir reels propios

      const reels = await Reel.find({
        userId: { $in: followingIds }
      })
        .populate('userId', USER_BASIC_FIELDS)
        .sort({ createdAt: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await Reel.countDocuments({
        userId: { $in: followingIds }
      })

      const response = createPaginatedResponse(reels, total, page, limit)

      return this.sendSuccess(res, response, 'Feed de reels obtenido exitosamente')

    } catch (error) {
      logger.error('❌ Error en getReelsFeed:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener reels de un usuario específico
   */
  async getUserReels(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { userId } = req.params
      const { page = 1, limit = 20 } = req.query
      const paginationOptions = getPaginationOptions(page, limit)

      const reels = await Reel.find({ userId })
        .populate('userId', USER_BASIC_FIELDS)
        .sort({ createdAt: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await Reel.countDocuments({ userId })

      const response = createPaginatedResponse(reels, total, page, limit)

      return this.sendSuccess(res, response, 'Reels del usuario obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getUserReels:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Buscar reels
   */
  async searchReels(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { q, page = 1, limit = 20 } = req.query
      const paginationOptions = getPaginationOptions(page, limit)

      const searchQuery = {
        $or: [
          { caption: { $regex: q, $options: 'i' } },
          { hashtags: { $in: [new RegExp(q, 'i')] } }
        ]
      }

      const reels = await Reel.find(searchQuery)
        .populate('userId', USER_BASIC_FIELDS)
        .sort({ createdAt: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await Reel.countDocuments(searchQuery)

      const response = createPaginatedResponse(reels, total, page, limit)

      return this.sendSuccess(res, response, 'Búsqueda de reels completada')

    } catch (error) {
      logger.error('❌ Error en searchReels:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener reels trending
   */
  async getTrendingReels(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query
      const paginationOptions = getPaginationOptions(page, limit)

      // Obtener reels con más engagement en las últimas 24 horas
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const reels = await Reel.find({
        createdAt: { $gte: yesterday }
      })
        .populate('userId', USER_BASIC_FIELDS)
        .sort({
          views: -1,
          'likes': -1,
          createdAt: -1
        })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await Reel.countDocuments({
        createdAt: { $gte: yesterday }
      })

      const response = createPaginatedResponse(reels, total, page, limit)

      return this.sendSuccess(res, response, 'Reels trending obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getTrendingReels:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener estadísticas de un reel
   */
  async getReelStats(req, res) {
    try {
      const { id } = req.params

      const reel = await Reel.findById(id)
      if (!reel) {
        return this.sendError(res, 'Reel no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (reel.userId.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para ver estas estadísticas', 403)
      }

      const stats = {
        views: reel.views,
        likes: reel.likes.length,
        comments: reel.comments.length,
        shares: reel.shares,
        engagement: reel.likes.length + reel.comments.length + reel.shares
      }

      return this.sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente')

    } catch (error) {
      logger.error('❌ Error en getReelStats:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Notificar a seguidores sobre nuevo reel
   */
  async notifyFollowersNewReel(userId, reelId) {
    try {
      const user = await User.findById(userId)
      const followers = await User.find({ 'following.userId': userId })

      for (const follower of followers) {
        const notification = new Notification({
          userId: follower._id,
          type: 'new_reel',
          fromUserId: userId,
          message: `${user.username} compartió un nuevo reel`,
          data: { reelId }
        })
        await notification.save()
      }
    } catch (error) {
      logger.error('Error notificando seguidores sobre nuevo reel:', error)
    }
  }

  /**
   * Enviar notificación de like
   */
  async sendLikeNotification(toUserId, fromUserId, contentId, contentType) {
    try {
      const fromUser = await User.findById(fromUserId)

      const notification = new Notification({
        userId: toUserId,
        type: 'like',
        fromUserId,
        message: `A ${fromUser.username} le gustó tu ${contentType}`,
        data: { contentId, contentType }
      })
      await notification.save()
    } catch (error) {
      logger.error('Error enviando notificación de like:', error)
    }
  }
}

// Crear instancia del controlador
const reelController = new RefactoredReelController()

// Exportar métodos como funciones individuales para compatibilidad con rutas
export const {
  createReel,
  getReel,
  updateReel,
  deleteReel,
  likeReel,
  getReelsFeed,
  getUserReels,
  searchReels,
  getTrendingReels,
  getReelStats
} = reelController

// Exportar también la clase para testing
export { RefactoredReelController, reelController }
