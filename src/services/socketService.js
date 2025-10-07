const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { config } = require('../utils/config')
const logger = require('../utils/logger')

class SocketService {
  constructor() {
    this.io = null
    this.connectedUsers = new Map() // userId -> socketId
    this.userSockets = new Map() // socketId -> userId
  }

  initialize(server) {
    const { Server } = require('socket.io')

    this.io = new Server(server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    })

    this.setupMiddleware()
    this.setupEventHandlers()

    logger.info('🔌 Socket.IO inicializado correctamente')
  }

  setupMiddleware() {
    // Middleware de autenticación para WebSockets
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')

        if (!token) {
          return next(new Error('Token de autenticación requerido'))
        }

        const decoded = jwt.verify(token, config.jwtSecret)
        const user = await User.findById(decoded.id).select('username avatar fullName')

        if (!user) {
          return next(new Error('Usuario no encontrado'))
        }

        socket.userId = decoded.id
        socket.user = user
        next()
      } catch (error) {
        logger.error('Error en autenticación de socket:', error)
        next(new Error('Token inválido'))
      }
    })
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`👤 Usuario conectado: ${socket.user.username} (${socket.id})`)

      // Registrar usuario conectado
      this.connectedUsers.set(socket.userId, socket.id)
      this.userSockets.set(socket.id, socket.userId)

      // Notificar a contactos que el usuario está online
      this.notifyUserOnline(socket.userId)

      // Eventos de mensajería
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`)
        logger.info(`💬 ${socket.user.username} se unió a la conversación ${conversationId}`)
      })

      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`)
        logger.info(`💬 ${socket.user.username} salió de la conversación ${conversationId}`)
      })

      socket.on('send_message', async (data) => {
        try {
          const { conversationId, content, replyTo } = data

          // Validar datos
          if (!conversationId || !content) {
            socket.emit('error', { message: 'Datos de mensaje inválidos' })
            return
          }

          // Emitir mensaje a todos los participantes de la conversación
          this.io.to(`conversation_${conversationId}`).emit('new_message', {
            id: Date.now().toString(), // ID temporal
            conversationId,
            sender: {
              _id: socket.userId,
              username: socket.user.username,
              avatar: socket.user.avatar,
              fullName: socket.user.fullName
            },
            content,
            replyTo,
            createdAt: new Date(),
            isTemporary: true // Marcar como temporal hasta confirmación del servidor
          })

          logger.info(`💬 Mensaje enviado por ${socket.user.username} en conversación ${conversationId}`)
        } catch (error) {
          logger.error('Error enviando mensaje:', error)
          socket.emit('error', { message: 'Error enviando mensaje' })
        }
      })

      // Eventos de notificaciones
      socket.on('mark_notification_read', (notificationId) => {
        // Emitir confirmación de lectura
        socket.emit('notification_read', { notificationId })
      })

      // Eventos de posts/reels
      socket.on('like_post', (data) => {
        const { postId, userId } = data
        this.io.emit('post_liked', {
          postId,
          userId,
          username: socket.user.username,
          avatar: socket.user.avatar
        })
      })

      socket.on('like_reel', (data) => {
        const { reelId, userId } = data
        this.io.emit('reel_liked', {
          reelId,
          userId,
          username: socket.user.username,
          avatar: socket.user.avatar
        })
      })

      // Eventos de stories
      socket.on('view_story', (data) => {
        const { storyId, userId } = data
        this.io.emit('story_viewed', {
          storyId,
          userId,
          username: socket.user.username
        })
      })

      // Eventos de typing
      socket.on('typing_start', (data) => {
        const { conversationId } = data
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.user.username,
          conversationId
        })
      })

      socket.on('typing_stop', (data) => {
        const { conversationId } = data
        socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          conversationId
        })
      })

      // Manejo de desconexión
      socket.on('disconnect', () => {
        logger.info(`👤 Usuario desconectado: ${socket.user.username} (${socket.id})`)

        // Remover usuario de mapas
        this.connectedUsers.delete(socket.userId)
        this.userSockets.delete(socket.id)

        // Notificar que el usuario está offline
        this.notifyUserOffline(socket.userId)
      })
    })
  }

  // Métodos públicos para emitir eventos desde otros servicios
  emitNewMessage(conversationId, message) {
    this.io.to(`conversation_${conversationId}`).emit('new_message', message)
  }

  emitNewNotification(userId, notification) {
    const socketId = this.connectedUsers.get(userId)
    if (socketId) {
      this.io.to(socketId).emit('new_notification', notification)
    }
  }

  emitPostLiked(postId, userId, username, avatar) {
    this.io.emit('post_liked', {
      postId,
      userId,
      username,
      avatar
    })
  }

  emitReelLiked(reelId, userId, username, avatar) {
    this.io.emit('reel_liked', {
      reelId,
      userId,
      username,
      avatar
    })
  }

  emitStoryViewed(storyId, userId, username) {
    this.io.emit('story_viewed', {
      storyId,
      userId,
      username
    })
  }

  emitUserOnline(userId) {
    this.io.emit('user_online', { userId })
  }

  emitUserOffline(userId) {
    this.io.emit('user_offline', { userId })
  }

  // Métodos privados
  notifyUserOnline(userId) {
    this.io.emit('user_online', { userId })
  }

  notifyUserOffline(userId) {
    this.io.emit('user_offline', { userId })
  }

  // Verificar si un usuario está conectado
  isUserOnline(userId) {
    return this.connectedUsers.has(userId)
  }

  // Obtener socket ID de un usuario
  getUserSocketId(userId) {
    return this.connectedUsers.get(userId)
  }

  // Obtener todos los usuarios conectados
  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys())
  }
}

// Singleton instance
const socketService = new SocketService()

module.exports = socketService
