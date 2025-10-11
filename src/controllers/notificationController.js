import Notification from '../models/Notification.js'
import User from '../models/User.js'
import { validationResult } from 'express-validator'
import mongoose from 'mongoose'
import logger from '../utils/logger.js'

// Obtener notificaciones del usuario
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { type, unreadOnly } = req.query

    const options = {}
    if (type) { options.type = type }
    if (unreadOnly === 'true') { options.unreadOnly = true }

    const notifications = await Notification.findByUser(userId, options)
      .skip(skip)
      .limit(limit)

    const total = await Notification.countDocuments({
      user: userId,
      isDeleted: false,
      ...(type && { type }),
      ...(unreadOnly === 'true' && { isRead: false })
    })

    res.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getNotifications:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener conteo de notificaciones no leídas
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req
    const count = await Notification.getUnreadCount(userId)

    res.json({
      success: true,
      count
    })
  } catch (error) {
    logger.error('Error en getUnreadCount:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Marcar notificación como leída
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      })
    }

    // Verificar que el usuario sea el dueño de la notificación
    if (notification.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar esta notificación'
      })
    }

    await notification.markAsRead()

    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    })
  } catch (error) {
    logger.error('Error en markAsRead:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Marcar todas las notificaciones como leídas
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req
    await Notification.markAllAsRead(userId)

    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas'
    })
  } catch (error) {
    logger.error('Error en markAllAsRead:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar una notificación
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notificación no encontrada'
      })
    }

    // Verificar que el usuario sea el dueño de la notificación
    if (notification.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta notificación'
      })
    }

    await notification.softDelete()

    res.json({
      success: true,
      message: 'Notificación eliminada exitosamente'
    })
  } catch (error) {
    logger.error('Error en deleteNotification:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar todas las notificaciones leídas
export const deleteReadNotifications = async (req, res) => {
  try {
    const { userId } = req

    await Notification.updateMany(
      { user: userId, isRead: true, isDeleted: false },
      { $set: { isDeleted: true } }
    )

    res.json({
      success: true,
      message: 'Notificaciones leídas eliminadas exitosamente'
    })
  } catch (error) {
    logger.error('Error en deleteReadNotifications:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Crear una notificación manual (para testing o casos especiales)
export const createNotification = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { userId, fromUserId, type, title, message, data } = req.body

    // Verificar que el usuario existe
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar que el usuario que genera la notificación existe
    const fromUser = await User.findById(fromUserId)
    if (!fromUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario que genera la notificación no encontrado'
      })
    }

    const notification = new Notification({
      user: userId,
      from: fromUserId,
      type,
      title,
      message,
      data
    })

    await notification.save()
    await notification.populate('from', 'username avatar fullName')

    res.status(201).json({
      success: true,
      message: 'Notificación creada exitosamente',
      notification
    })
  } catch (error) {
    logger.error('Error en createNotification:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener estadísticas de notificaciones
export const getNotificationStats = async (req, res) => {
  try {
    const { userId } = req

    const stats = await Notification.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId), isDeleted: false } },
      { $group: {
        _id: '$type',
        count: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: ['$isRead', 0, 1] }
        }
      } },
      { $sort: { count: -1 } }
    ])

    const totalNotifications = await Notification.countDocuments({
      user: userId,
      isDeleted: false
    })

    const unreadCount = await Notification.getUnreadCount(userId)

    res.json({
      success: true,
      stats: {
        total: totalNotifications,
        unread: unreadCount,
        byType: stats
      }
    })
  } catch (error) {
    logger.error('Error en getNotificationStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Limpiar notificaciones antiguas (tarea programada)
export const cleanupOldNotifications = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    const result = await Notification.deleteOldNotifications(days)

    res.json({
      success: true,
      message: `Limpieza de notificaciones antiguas completada (${days} días)`,
      result
    })
  } catch (error) {
    logger.error('Error en cleanupOldNotifications:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
