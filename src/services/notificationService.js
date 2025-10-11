import Notification from '../models/Notification.js'
import User from '../models/User.js'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'

/**
 * Servicio de notificaciones para CircleSfera
 * Maneja la creación, envío y gestión de notificaciones
 */
class NotificationService {
  constructor() {
    this.socketService = null
    this.initializeSocketService()
  }

  /**
   * Inicializar servicio de WebSocket
   */
  initializeSocketService() {
    try {
      this.socketService = require('./socketService')
    } catch (error) {
      logger.warn('Socket service no disponible:', error.message)
    }
  }

  /**
   * Crear una notificación
   * @param {Object} data - Datos de la notificación
   * @returns {Promise<Notification>}
   */
  async createNotification(data) {
    try {
      const {
        user,
        from,
        type,
        title,
        message,
        data: notificationData,
        priority = 'normal'
      } = data

      // Validar que el usuario existe
      const targetUser = await User.findById(user).select('username preferences')
      if (!targetUser) {
        throw new Error('Usuario destino no encontrado')
      }

      // Verificar preferencias de notificación
      if (!this.shouldSendNotification(targetUser, type)) {
        logger.debug('Notificación bloqueada por preferencias:', { user, type })
        return null
      }

      const notification = new Notification({
        user,
        from,
        type,
        title,
        message,
        data: notificationData,
        priority
      })

      await notification.save()
      await notification.populate('from', 'username avatar fullName isVerified')

      // Invalidar caché de notificaciones
      cache.deletePattern(`notifications:${user}:*`)
      cache.delete(`unread_count:${user}`)

      // Enviar notificación en tiempo real
      await this.sendRealTimeNotification(notification)

      logger.info('Notificación creada:', {
        id: notification._id,
        user,
        type,
        title
      })

      return notification
    } catch (error) {
      logger.error('Error creando notificación:', error)
      throw error
    }
  }

  /**
   * Verificar si se debe enviar la notificación según preferencias
   * @param {User} user - Usuario destino
   * @param {string} type - Tipo de notificación
   * @returns {boolean}
   */
  shouldSendNotification(user, type) {
    if (!user.preferences || !user.preferences.notifications) {
      return true // Enviar por defecto si no hay preferencias
    }

    const preferences = user.preferences.notifications
    const typeMap = {
      like: 'likes',
      comment: 'comments',
      follow: 'follows',
      mention: 'mentions',
      message: 'messages',
      story: 'stories',
      post: 'posts',
      reel: 'reels'
    }

    const preferenceKey = typeMap[type]
    return preferenceKey ? preferences[preferenceKey] !== false : true
  }

  /**
   * Enviar notificación en tiempo real
   * @param {Notification} notification - Notificación a enviar
   */
  sendRealTimeNotification(notification) {
    try {
      if (this.socketService) {
        this.socketService.emitToUser(notification.user.toString(), 'notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          from: notification.from,
          createdAt: notification.createdAt,
          isRead: notification.isRead
        })
      }
    } catch (error) {
      logger.error('Error enviando notificación en tiempo real:', error)
    }
  }

  /**
   * Crear notificación de like en post/reel/story
   * @param {string} userId - ID del usuario que recibe la notificación
   * @param {string} fromUserId - ID del usuario que da like
   * @param {string} contentType - Tipo de contenido (post, reel, story)
   * @param {string} contentId - ID del contenido
   */
  async createLikeNotification(userId, fromUserId, contentType, contentId) {
    if (userId === fromUserId) { return } // No notificar likes propios

    const typeMap = {
      post: 'like',
      reel: 'like',
      story: 'like',
      cstv: 'like'
    }

    const titleMap = {
      post: 'le gustó tu publicación',
      reel: 'le gustó tu reel',
      story: 'le gustó tu historia',
      cstv: 'le gustó tu video'
    }

    return this.createNotification({
      user: userId,
      from: fromUserId,
      type: typeMap[contentType] || 'like',
      title: titleMap[contentType] || 'le gustó tu contenido',
      message: `@${await this.getUsername(fromUserId)} ${titleMap[contentType] || 'le gustó tu contenido'}`,
      data: {
        [contentType]: contentId
      }
    })
  }

  /**
   * Crear notificación de comentario
   * @param {string} userId - ID del usuario que recibe la notificación
   * @param {string} fromUserId - ID del usuario que comenta
   * @param {string} contentType - Tipo de contenido
   * @param {string} contentId - ID del contenido
   * @param {string} commentId - ID del comentario
   */
  async createCommentNotification(userId, fromUserId, contentType, contentId, commentId) {
    if (userId === fromUserId) { return }

    const titleMap = {
      post: 'comentó en tu publicación',
      reel: 'comentó en tu reel',
      story: 'comentó en tu historia',
      cstv: 'comentó en tu video'
    }

    return this.createNotification({
      user: userId,
      from: fromUserId,
      type: 'comment',
      title: titleMap[contentType] || 'comentó en tu contenido',
      message: `@${await this.getUsername(fromUserId)} ${titleMap[contentType] || 'comentó en tu contenido'}`,
      data: {
        [contentType]: contentId,
        comment: commentId
      }
    })
  }

  /**
   * Crear notificación de seguimiento
   * @param {string} userId - ID del usuario que recibe la notificación
   * @param {string} fromUserId - ID del usuario que sigue
   */
  async createFollowNotification(userId, fromUserId) {
    if (userId === fromUserId) { return }

    return this.createNotification({
      user: userId,
      from: fromUserId,
      type: 'follow',
      title: 'te siguió',
      message: `@${await this.getUsername(fromUserId)} te siguió`,
      data: {
        follow: true
      }
    })
  }

  /**
   * Crear notificación de mención
   * @param {string} userId - ID del usuario mencionado
   * @param {string} fromUserId - ID del usuario que menciona
   * @param {string} contentType - Tipo de contenido
   * @param {string} contentId - ID del contenido
   * @param {string} context - Contexto de la mención
   */
  async createMentionNotification(userId, fromUserId, contentType, contentId, context) {
    if (userId === fromUserId) { return }

    return this.createNotification({
      user: userId,
      from: fromUserId,
      type: 'mention',
      title: 'te mencionó',
      message: `@${await this.getUsername(fromUserId)} te mencionó en ${context}`,
      data: {
        [contentType]: contentId,
        context
      }
    })
  }

  /**
   * Crear notificación de mensaje
   * @param {string} userId - ID del usuario que recibe el mensaje
   * @param {string} fromUserId - ID del usuario que envía
   * @param {string} conversationId - ID de la conversación
   * @param {string} messagePreview - Vista previa del mensaje
   */
  async createMessageNotification(userId, fromUserId, conversationId, messagePreview) {
    if (userId === fromUserId) { return }

    return this.createNotification({
      user: userId,
      from: fromUserId,
      type: 'message',
      title: 'te envió un mensaje',
      message: `@${await this.getUsername(fromUserId)}: ${messagePreview}`,
      data: {
        conversation: conversationId,
        preview: messagePreview
      }
    })
  }

  /**
   * Obtener username por ID
   * @param {string} userId - ID del usuario
   * @returns {Promise<string>}
   */
  async getUsername(userId) {
    try {
      const cachedUsername = cache.get(`username:${userId}`)
      if (cachedUsername) {
        return cachedUsername
      }

      const user = await User.findById(userId).select('username')
      if (user) {
        cache.set(`username:${userId}`, user.username, 3600) // Cache por 1 hora
        return user.username
      }
      return 'Usuario'
    } catch (error) {
      logger.error('Error obteniendo username:', error)
      return 'Usuario'
    }
  }

  /**
   * Obtener notificaciones del usuario con caché
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Array>}
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const { page = 1, limit = 20, type, unreadOnly } = options
      const cacheKey = `notifications:${userId}:${page}:${limit}:${type || 'all'}:${unreadOnly || 'all'}`

      // Intentar obtener del caché
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }

      const query = {
        user: userId,
        isDeleted: false
      }

      if (type) { query.type = type }
      if (unreadOnly) { query.isRead = false }

      const notifications = await Notification.find(query)
        .populate('from', 'username avatar fullName isVerified')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

      // Guardar en caché por 2 minutos
      cache.set(cacheKey, notifications, 120)

      return notifications
    } catch (error) {
      logger.error('Error obteniendo notificaciones:', error)
      throw error
    }
  }

  /**
   * Obtener conteo de notificaciones no leídas con caché
   * @param {string} userId - ID del usuario
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    try {
      const cacheKey = `unread_count:${userId}`

      // Intentar obtener del caché
      const cached = cache.get(cacheKey)
      if (cached !== null) {
        return cached
      }

      const count = await Notification.countDocuments({
        user: userId,
        isRead: false,
        isDeleted: false
      })

      // Guardar en caché por 1 minuto
      cache.set(cacheKey, count, 60)

      return count
    } catch (error) {
      logger.error('Error obteniendo conteo de notificaciones no leídas:', error)
      return 0
    }
  }

  /**
   * Marcar notificación como leída
   * @param {string} notificationId - ID de la notificación
   * @param {string} userId - ID del usuario
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        user: userId,
        isDeleted: false
      })

      if (!notification) {
        throw new Error('Notificación no encontrada')
      }

      if (!notification.isRead) {
        notification.isRead = true
        await notification.save()

        // Invalidar caché
        cache.deletePattern(`notifications:${userId}:*`)
        cache.delete(`unread_count:${userId}`)
      }

      return notification
    } catch (error) {
      logger.error('Error marcando notificación como leída:', error)
      throw error
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   * @param {string} userId - ID del usuario
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { user: userId, isRead: false, isDeleted: false },
        { $set: { isRead: true } }
      )

      // Invalidar caché
      cache.deletePattern(`notifications:${userId}:*`)
      cache.delete(`unread_count:${userId}`)

      return result
    } catch (error) {
      logger.error('Error marcando todas las notificaciones como leídas:', error)
      throw error
    }
  }

  /**
   * Eliminar notificación
   * @param {string} notificationId - ID de la notificación
   * @param {string} userId - ID del usuario
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        user: userId,
        isDeleted: false
      })

      if (!notification) {
        throw new Error('Notificación no encontrada')
      }

      await notification.softDelete()

      // Invalidar caché
      cache.deletePattern(`notifications:${userId}:*`)
      cache.delete(`unread_count:${userId}`)

      return notification
    } catch (error) {
      logger.error('Error eliminando notificación:', error)
      throw error
    }
  }

  /**
   * Limpiar notificaciones antiguas
   * @param {number} days - Días de antigüedad
   */
  async cleanupOldNotifications(days = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true,
        isDeleted: false
      })

      logger.info('Limpieza de notificaciones antiguas completada:', {
        days,
        deleted: result.deletedCount
      })

      return result
    } catch (error) {
      logger.error('Error limpiando notificaciones antiguas:', error)
      throw error
    }
  }
}

// Instancia singleton del servicio
const notificationService = new NotificationService()

export default notificationService
