/**
 * 🔔 REFACTORED NOTIFICATION CONTROLLER
 * =====================================
 * Controlador de notificaciones refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import logger from '../utils/logger.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class NotificationController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para marcar notificaciones como leídas
  static markAsReadValidations = [
    body('notificationIds')
      .optional()
      .isArray()
      .withMessage('Los IDs de notificaciones deben ser un array')
  ]

  // Obtener notificaciones del usuario
  async getNotifications(req, res) {
    try {
      const { page = 1, limit = 20, type, unreadOnly } = req.query
      const skip = (page - 1) * limit

      const options = {}
      if (type) { options.type = type }
      if (unreadOnly === 'true') { options.unreadOnly = true }

      const notifications = await Notification.findByUser(req.user.id, options)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })

      const total = await Notification.countDocuments({
        user: req.user.id,
        isDeleted: false,
        ...(type && { type }),
        ...(unreadOnly === 'true' && { isRead: false })
      })

      const responseData = {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }

      return this.sendSuccess(res, responseData, 'Notificaciones obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getNotifications', {
        userId: req.user?.id
      })
    }
  }

  // Obtener conteo de notificaciones no leídas
  async getUnreadCount(req, res) {
    try {
      const count = await Notification.getUnreadCount(req.user.id)

      return this.sendSuccess(res, { count }, 'Conteo de notificaciones no leídas obtenido')

    } catch (error) {
      return this.handleError(error, res, 'getUnreadCount', {
        userId: req.user?.id
      })
    }
  }

  // Marcar notificación como leída
  async markAsRead(req, res) {
    try {
      const { notificationId } = req.params

      const notification = await Notification.findById(notificationId)
      if (!notification) {
        return this.sendError(res, 'Notificación no encontrada', 404)
      }

      // Verificar que el usuario sea el dueño de la notificación
      if (notification.user.toString() !== req.user.id) {
        return this.sendError(res, 'No tienes permisos para modificar esta notificación', 403)
      }

      await notification.markAsRead()

      logger.info('Notificación marcada como leída', {
        notificationId,
        userId: req.user.id
      })

      return this.sendSuccess(res, null, 'Notificación marcada como leída')

    } catch (error) {
      return this.handleError(error, res, 'markAsRead', {
        notificationId: req.params?.notificationId,
        userId: req.user?.id
      })
    }
  }

  // Marcar múltiples notificaciones como leídas
  async markMultipleAsRead(req, res) {
    try {
      const { notificationIds } = req.body

      if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        return this.sendError(res, 'Se requiere un array de IDs de notificaciones', 400)
      }

      // Verificar que todas las notificaciones pertenecen al usuario
      const notifications = await Notification.find({
        _id: { $in: notificationIds },
        user: req.user.id,
        isDeleted: false
      })

      if (notifications.length !== notificationIds.length) {
        return this.sendError(res, 'Una o más notificaciones no existen o no te pertenecen', 400)
      }

      // Marcar como leídas
      await Notification.updateMany(
        { _id: { $in: notificationIds } },
        { isRead: true, readAt: new Date() }
      )

      logger.info('Múltiples notificaciones marcadas como leídas', {
        notificationIds,
        userId: req.user.id,
        count: notificationIds.length
      })

      return this.sendSuccess(res, null, `${notificationIds.length} notificaciones marcadas como leídas`)

    } catch (error) {
      return this.handleError(error, res, 'markMultipleAsRead', {
        notificationIds: req.body?.notificationIds,
        userId: req.user?.id
      })
    }
  }

  // Marcar todas las notificaciones como leídas
  async markAllAsRead(req, res) {
    try {
      const result = await Notification.updateMany(
        { user: req.user.id, isRead: false, isDeleted: false },
        { isRead: true, readAt: new Date() }
      )

      logger.info('Todas las notificaciones marcadas como leídas', {
        userId: req.user.id,
        modifiedCount: result.modifiedCount
      })

      return this.sendSuccess(res, { modifiedCount: result.modifiedCount }, 'Todas las notificaciones marcadas como leídas')

    } catch (error) {
      return this.handleError(error, res, 'markAllAsRead', {
        userId: req.user?.id
      })
    }
  }

  // Eliminar notificación
  async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params

      const notification = await Notification.findById(notificationId)
      if (!notification) {
        return this.sendError(res, 'Notificación no encontrada', 404)
      }

      // Verificar que el usuario sea el dueño de la notificación
      if (notification.user.toString() !== req.user.id) {
        return this.sendError(res, 'No tienes permisos para eliminar esta notificación', 403)
      }

      await notification.delete()

      logger.info('Notificación eliminada', {
        notificationId,
        userId: req.user.id
      })

      return this.sendSuccess(res, null, 'Notificación eliminada exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'deleteNotification', {
        notificationId: req.params?.notificationId,
        userId: req.user?.id
      })
    }
  }

  // Eliminar múltiples notificaciones
  async deleteMultipleNotifications(req, res) {
    try {
      const { notificationIds } = req.body

      if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        return this.sendError(res, 'Se requiere un array de IDs de notificaciones', 400)
      }

      // Verificar que todas las notificaciones pertenecen al usuario
      const notifications = await Notification.find({
        _id: { $in: notificationIds },
        user: req.user.id,
        isDeleted: false
      })

      if (notifications.length !== notificationIds.length) {
        return this.sendError(res, 'Una o más notificaciones no existen o no te pertenecen', 400)
      }

      // Eliminar notificaciones
      const result = await Notification.updateMany(
        { _id: { $in: notificationIds } },
        { isDeleted: true, deletedAt: new Date() }
      )

      logger.info('Múltiples notificaciones eliminadas', {
        notificationIds,
        userId: req.user.id,
        deletedCount: result.modifiedCount
      })

      return this.sendSuccess(res, { deletedCount: result.modifiedCount }, `${result.modifiedCount} notificaciones eliminadas`)

    } catch (error) {
      return this.handleError(error, res, 'deleteMultipleNotifications', {
        notificationIds: req.body?.notificationIds,
        userId: req.user?.id
      })
    }
  }

  // Eliminar todas las notificaciones
  async deleteAllNotifications(req, res) {
    try {
      const result = await Notification.updateMany(
        { user: req.user.id, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() }
      )

      logger.info('Todas las notificaciones eliminadas', {
        userId: req.user.id,
        deletedCount: result.modifiedCount
      })

      return this.sendSuccess(res, { deletedCount: result.modifiedCount }, 'Todas las notificaciones eliminadas')

    } catch (error) {
      return this.handleError(error, res, 'deleteAllNotifications', {
        userId: req.user?.id
      })
    }
  }

  // Obtener notificaciones por tipo
  async getNotificationsByType(req, res) {
    try {
      const { type } = req.params
      const { page = 1, limit = 20 } = req.query
      const skip = (page - 1) * limit

      // Validar tipo de notificación
      const validTypes = ['like', 'comment', 'follow', 'message', 'post', 'story', 'conversation']
      if (!validTypes.includes(type)) {
        return this.sendError(res, 'Tipo de notificación no válido', 400)
      }

      const notifications = await Notification.find({
        user: req.user.id,
        type,
        isDeleted: false
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))

      const total = await Notification.countDocuments({
        user: req.user.id,
        type,
        isDeleted: false
      })

      const responseData = {
        notifications,
        type,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }

      return this.sendSuccess(res, responseData, `Notificaciones de tipo ${type} obtenidas exitosamente`)

    } catch (error) {
      return this.handleError(error, res, 'getNotificationsByType', {
        type: req.params?.type,
        userId: req.user?.id
      })
    }
  }

  // Obtener estadísticas de notificaciones
  async getNotificationStats(req, res) {
    try {
      const totalNotifications = await Notification.countDocuments({
        user: req.user.id,
        isDeleted: false
      })

      const unreadNotifications = await Notification.countDocuments({
        user: req.user.id,
        isRead: false,
        isDeleted: false
      })

      // Estadísticas por tipo
      const statsByType = await Notification.aggregate([
        {
          $match: {
            user: req.user.id,
            isDeleted: false
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            unread: {
              $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
            }
          }
        }
      ])

      const stats = {
        total: totalNotifications,
        unread: unreadNotifications,
        byType: statsByType.reduce((acc, item) => {
          acc[item._id] = {
            total: item.count,
            unread: item.unread
          }
          return acc
        }, {})
      }

      return this.sendSuccess(res, stats, 'Estadísticas de notificaciones obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getNotificationStats', {
        userId: req.user?.id
      })
    }
  }
}

// Crear instancia del controlador
const notificationController = new NotificationController()

export { notificationController, NotificationController }
