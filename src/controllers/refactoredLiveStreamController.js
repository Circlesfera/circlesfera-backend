import BaseController from './BaseController.js'
import LiveStream from '../models/LiveStream.js'
import LiveComment from '../models/LiveComment.js'
import CSTV from '../models/CSTV.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { body, param, query } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import {
  createPaginatedResponse,
  getPaginationOptions,
  USER_BASIC_FIELDS
} from '../utils/queryOptimizer.js'

/**
 * Controlador refactorizado para Live Streams
 * Extiende BaseController para consistencia arquitectónica
 */
class RefactoredLiveStreamController extends BaseController {
  constructor() {
    super()
    this.model = LiveStream
    this.modelName = 'LiveStream'

    // Configurar reglas de validación
    this.setupValidationRules()
  }

  /**
   * Configurar reglas de validación para todos los métodos
   */
  setupValidationRules() {
    this.validationRules = {
      createLiveStream: [
        body('title')
          .notEmpty()
          .withMessage('El título es requerido')
          .isLength({ max: 100 })
          .withMessage('El título no puede exceder 100 caracteres'),
        body('description')
          .optional()
          .isLength({ max: 500 })
          .withMessage('La descripción no puede exceder 500 caracteres'),
        body('category')
          .optional()
          .isString()
          .withMessage('La categoría debe ser texto'),
        body('isPublic')
          .optional()
          .isBoolean()
          .withMessage('isPublic debe ser booleano')
      ],
      getLiveStream: [
        param('id')
          .isMongoId()
          .withMessage('ID de live stream inválido')
      ],
      updateLiveStream: [
        param('id')
          .isMongoId()
          .withMessage('ID de live stream inválido'),
        body('title')
          .optional()
          .isLength({ max: 100 })
          .withMessage('El título no puede exceder 100 caracteres'),
        body('description')
          .optional()
          .isLength({ max: 500 })
          .withMessage('La descripción no puede exceder 500 caracteres')
      ],
      endLiveStream: [
        param('id')
          .isMongoId()
          .withMessage('ID de live stream inválido')
      ],
      joinLiveStream: [
        param('id')
          .isMongoId()
          .withMessage('ID de live stream inválido')
      ],
      leaveLiveStream: [
        param('id')
          .isMongoId()
          .withMessage('ID de live stream inválido')
      ],
      getLiveStreams: [
        query('page')
          .optional()
          .isInt({ min: 1 })
          .withMessage('La página debe ser un número entero mayor a 0'),
        query('limit')
          .optional()
          .isInt({ min: 1, max: 50 })
          .withMessage('El límite debe estar entre 1 y 50'),
        query('category')
          .optional()
          .isString()
          .withMessage('La categoría debe ser texto')
      ],
      getUserLiveStreams: [
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
      ]
    }
  }

  /**
   * Crear un nuevo live stream
   */
  async createLiveStream(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { title, description, category, isPublic = true } = req.body

      // Verificar que el usuario no tenga un live stream activo
      const existingLiveStream = await LiveStream.findOne({
        user: req.user.id,
        status: { $in: ['starting', 'live'] }
      })

      if (existingLiveStream) {
        return this.sendError(res, 'Ya tienes un live stream activo', 400)
      }

      const liveStreamData = {
        user: req.user.id,
        title,
        description: description || '',
        category: category || 'general',
        isPublic,
        status: 'starting',
        viewers: [],
        comments: [],
        startTime: new Date(),
        endTime: null,
        duration: 0,
        totalViewers: 0,
        peakViewers: 0
      }

      const liveStream = new LiveStream(liveStreamData)
      await liveStream.save()

      // Poblar datos del usuario
      await liveStream.populate('user', USER_BASIC_FIELDS)

      logger.info('✅ Live stream creado:', {
        liveStreamId: liveStream._id,
        userId: req.user.id,
        title
      })

      return this.sendSuccess(res, liveStream, 'Live stream creado exitosamente', 201)

    } catch (error) {
      logger.error('❌ Error en createLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener un live stream específico
   */
  async getLiveStream(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params

      const liveStream = await LiveStream.findById(id)
        .populate('user', USER_BASIC_FIELDS)
        .populate('viewers.user', USER_BASIC_FIELDS)

      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Verificar si es público o el usuario es el propietario
      if (!liveStream.isPublic && liveStream.user._id.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para ver este live stream', 403)
      }

      return this.sendSuccess(res, liveStream, 'Live stream obtenido exitosamente')

    } catch (error) {
      logger.error('❌ Error en getLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Actualizar un live stream
   */
  async updateLiveStream(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params
      const { title, description } = req.body

      const liveStream = await LiveStream.findById(id)
      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (liveStream.user.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para editar este live stream', 403)
      }

      // Solo permitir actualizaciones si está en estado 'starting' o 'live'
      if (!['starting', 'live'].includes(liveStream.status)) {
        return this.sendError(res, 'No se puede editar un live stream terminado', 400)
      }

      const updateData = {}
      if (title !== undefined) {
        updateData.title = title
      }
      if (description !== undefined) {
        updateData.description = description
      }

      const updatedLiveStream = await LiveStream.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      ).populate('user', USER_BASIC_FIELDS)

      return this.sendSuccess(res, updatedLiveStream, 'Live stream actualizado exitosamente')

    } catch (error) {
      logger.error('❌ Error en updateLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Iniciar un live stream
   */
  async startLiveStream(req, res) {
    try {
      const { id } = req.params

      const liveStream = await LiveStream.findById(id)
      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (liveStream.user.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para iniciar este live stream', 403)
      }

      // Verificar que está en estado 'starting'
      if (liveStream.status !== 'starting') {
        return this.sendError(res, 'El live stream no está en estado de inicio', 400)
      }

      // Actualizar estado a 'live'
      liveStream.status = 'live'
      liveStream.startTime = new Date()
      await liveStream.save()

      // Notificar a seguidores
      await this.notifyFollowersAboutLive(liveStream)

      logger.info('✅ Live stream iniciado:', {
        liveStreamId: liveStream._id,
        userId: req.user.id
      })

      return this.sendSuccess(res, liveStream, 'Live stream iniciado exitosamente')

    } catch (error) {
      logger.error('❌ Error en startLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Terminar un live stream
   */
  async endLiveStream(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params
      const { saveToCSTV = false, cstvTitle, cstvDescription } = req.body

      const liveStream = await LiveStream.findById(id)
      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (liveStream.user.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para terminar este live stream', 403)
      }

      // Verificar que está en estado 'live'
      if (liveStream.status !== 'live') {
        return this.sendError(res, 'El live stream no está activo', 400)
      }

      // Calcular duración
      const endTime = new Date()
      const duration = Math.floor((endTime - liveStream.startTime) / 1000)

      // Actualizar live stream
      liveStream.status = 'ended'
      liveStream.endTime = endTime
      liveStream.duration = duration
      liveStream.totalViewers = liveStream.viewers.length
      liveStream.peakViewers = Math.max(liveStream.peakViewers, liveStream.viewers.length)
      await liveStream.save()

      // Guardar en CSTV si se solicita
      if (saveToCSTV) {
        await this.saveLiveToCSTV(liveStream, {
          title: cstvTitle || liveStream.title,
          description: cstvDescription || liveStream.description
        })
      }

      logger.info('✅ Live stream terminado:', {
        liveStreamId: liveStream._id,
        userId: req.user.id,
        duration
      })

      return this.sendSuccess(res, liveStream, 'Live stream terminado exitosamente')

    } catch (error) {
      logger.error('❌ Error en endLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Unirse a un live stream
   */
  async joinLiveStream(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params

      const liveStream = await LiveStream.findById(id)
      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Verificar que está en estado 'live'
      if (liveStream.status !== 'live') {
        return this.sendError(res, 'El live stream no está activo', 400)
      }

      // Verificar si es público o el usuario es el propietario
      if (!liveStream.isPublic && liveStream.user.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para ver este live stream', 403)
      }

      // Verificar si el usuario ya está viendo
      const existingViewer = liveStream.viewers.find(
        viewer => viewer.user.toString() === req.user.id
      )

      if (!existingViewer) {
        // Agregar como viewer
        liveStream.viewers.push({
          user: req.user.id,
          joinedAt: new Date()
        })

        // Actualizar peak viewers
        liveStream.peakViewers = Math.max(
          liveStream.peakViewers,
          liveStream.viewers.length
        )

        await liveStream.save()
      }

      return this.sendSuccess(res, { joined: true }, 'Te uniste al live stream exitosamente')

    } catch (error) {
      logger.error('❌ Error en joinLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Salir de un live stream
   */
  async leaveLiveStream(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params

      const liveStream = await LiveStream.findById(id)
      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Remover de viewers
      liveStream.viewers = liveStream.viewers.filter(
        viewer => viewer.user.toString() !== req.user.id
      )

      await liveStream.save()

      return this.sendSuccess(res, { left: true }, 'Saliste del live stream exitosamente')

    } catch (error) {
      logger.error('❌ Error en leaveLiveStream:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener live streams activos
   */
  async getLiveStreams(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { page = 1, limit = 20, category } = req.query
      const paginationOptions = getPaginationOptions(page, limit)

      const query = {
        status: 'live',
        isPublic: true
      }

      if (category) {
        query.category = category
      }

      const liveStreams = await LiveStream.find(query)
        .populate('user', USER_BASIC_FIELDS)
        .sort({ startTime: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await LiveStream.countDocuments(query)

      const response = createPaginatedResponse(liveStreams, total, page, limit)

      return this.sendSuccess(res, response, 'Live streams obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getLiveStreams:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener live streams de un usuario
   */
  async getUserLiveStreams(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { userId } = req.params
      const { page = 1, limit = 20 } = req.query
      const paginationOptions = getPaginationOptions(page, limit)

      const liveStreams = await LiveStream.find({ user: userId })
        .populate('user', USER_BASIC_FIELDS)
        .sort({ startTime: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)

      const total = await LiveStream.countDocuments({ user: userId })

      const response = createPaginatedResponse(liveStreams, total, page, limit)

      return this.sendSuccess(res, response, 'Live streams del usuario obtenidos exitosamente')

    } catch (error) {
      logger.error('❌ Error en getUserLiveStreams:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Obtener estadísticas de un live stream
   */
  async getLiveStreamStats(req, res) {
    try {
      const { id } = req.params

      const liveStream = await LiveStream.findById(id)
      if (!liveStream) {
        return this.sendError(res, 'Live stream no encontrado', 404)
      }

      // Verificar que el usuario es el propietario
      if (liveStream.user.toString() !== req.user.id) {
        return this.sendError(res, 'No autorizado para ver estas estadísticas', 403)
      }

      const stats = {
        currentViewers: liveStream.viewers.length,
        totalViewers: liveStream.totalViewers,
        peakViewers: liveStream.peakViewers,
        duration: liveStream.duration,
        comments: liveStream.comments.length,
        status: liveStream.status
      }

      return this.sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente')

    } catch (error) {
      logger.error('❌ Error en getLiveStreamStats:', error)
      return this.sendError(res, 'Error interno del servidor', 500)
    }
  }

  /**
   * Notificar a seguidores sobre live stream
   */
  async notifyFollowersAboutLive(liveStream) {
    try {
      const user = await User.findById(liveStream.user)
      const followers = await User.find({ 'following.userId': liveStream.user })

      for (const follower of followers) {
        const notification = new Notification({
          userId: follower._id,
          type: 'live_started',
          fromUserId: liveStream.user,
          message: `${user.username} está transmitiendo en vivo`,
          data: {
            liveStreamId: liveStream._id,
            liveStreamTitle: liveStream.title
          }
        })
        await notification.save()
      }

      logger.info(`📺 Notificaciones enviadas a ${followers.length} seguidores sobre live stream`)
    } catch (error) {
      logger.error('Error notificando seguidores sobre live stream:', error)
    }
  }

  /**
   * Guardar live stream en CSTV
   */
  async saveLiveToCSTV(liveStream, options) {
    try {
      const cstvData = {
        user: liveStream.user,
        title: options.title,
        description: options.description,
        originalLiveStream: liveStream._id,
        duration: liveStream.duration,
        views: 0,
        likes: [],
        comments: [],
        category: liveStream.category,
        isPublic: true,
        status: 'published'
      }

      const cstv = new CSTV(cstvData)
      await cstv.save()

      logger.info('✅ Live stream guardado en CSTV:', {
        cstvId: cstv._id,
        liveStreamId: liveStream._id
      })

      return cstv
    } catch (error) {
      logger.error('Error guardando live stream en CSTV:', error)
      throw error
    }
  }
}

// Crear instancia del controlador
const liveStreamController = new RefactoredLiveStreamController()

// Exportar métodos como funciones individuales para compatibilidad con rutas
export const {
  createLiveStream,
  getLiveStream,
  updateLiveStream,
  startLiveStream,
  endLiveStream,
  joinLiveStream,
  leaveLiveStream,
  getLiveStreams,
  getUserLiveStreams,
  getLiveStreamStats
} = liveStreamController

// Exportar también la clase para testing
export { RefactoredLiveStreamController, liveStreamController }
