/**
 * 💬 REFACTORED MESSAGE CONTROLLER
 * ================================
 * Controlador de mensajes refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import Message from '../models/Message.js'
import Conversation from '../models/Conversation.js'
import Notification from '../models/Notification.js'
import socketService from '../services/socketService.js'
import logger from '../utils/logger.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class MessageController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para enviar mensaje
  static sendMessageValidations = [
    body('content')
      .optional()
      .isLength({ min: 1, max: 2000 })
      .withMessage('El contenido debe tener entre 1 y 2000 caracteres'),
    body('replyTo')
      .optional()
      .isMongoId()
      .withMessage('ID de mensaje a responder inválido')
  ]

  // Obtener mensajes de una conversación
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params
      const { page = 1, limit = 50 } = req.query
      const skip = (page - 1) * limit

      // Verificar que la conversación existe y el usuario es participante
      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      if (!conversation.participants.includes(req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      // Obtener mensajes
      const messages = await Message.findByConversation(conversationId, { skip, limit })

      // Verificar mensajes con sender null
      const messagesWithNullSender = messages.filter(msg => !msg.sender)
      if (messagesWithNullSender.length > 0) {
        logger.warn('Mensajes con sender null encontrados:', {
          conversationId,
          count: messagesWithNullSender.length,
          messageIds: messagesWithNullSender.map(msg => msg._id)
        })
      }

      const total = await Message.countDocuments({
        conversation: conversationId,
        isDeleted: false
      })

      // Marcar mensajes como leídos
      await Message.markConversationAsRead(conversationId, req.user.id)

      const responseData = {
        messages: messages.reverse(), // Ordenar por fecha ascendente
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }

      return this.sendSuccess(res, responseData, 'Mensajes obtenidos exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getMessages', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }

  // Enviar mensaje de texto
  async sendTextMessage(req, res) {
    try {
      const { conversationId } = req.params
      const { content, replyTo } = req.body

      if (!content || content.trim().length === 0) {
        return this.sendError(res, 'El contenido del mensaje no puede estar vacío', 400)
      }

      // Verificar que la conversación existe y el usuario es participante
      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      if (!conversation.participants.includes(req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      // Crear el mensaje
      const messageData = {
        conversation: conversationId,
        sender: req.user.id,
        content: content.trim(),
        type: 'text'
      }

      if (replyTo) {
        messageData.replyTo = replyTo
      }

      const message = new Message(messageData)
      await message.save()

      // Poblar el mensaje con datos del sender
      await message.populate('sender', 'username avatar fullName')

      // Emitir mensaje en tiempo real
      socketService.emitToConversation(conversationId, 'new_message', {
        message: message.toObject()
      })

      // Crear notificaciones para otros participantes
      const otherParticipants = conversation.participants.filter(
        p => p.toString() !== req.user.id
      )

      for (const participantId of otherParticipants) {
        await Notification.create({
          user: participantId,
          type: 'message',
          title: 'Nuevo mensaje',
          message: `${req.user.username}: ${content.substring(0, 50)}...`,
          data: {
            conversationId,
            messageId: message._id,
            senderId: req.user.id
          }
        })

        // Emitir notificación en tiempo real
        socketService.emitToUser(participantId, 'notification', {
          type: 'message',
          title: 'Nuevo mensaje',
          message: `${req.user.username}: ${content.substring(0, 50)}...`
        })
      }

      logger.info('Mensaje enviado exitosamente', {
        messageId: message._id,
        conversationId,
        senderId: req.user.id
      })

      return this.sendSuccess(res, message, 'Mensaje enviado exitosamente', 201)

    } catch (error) {
      return this.handleError(error, res, 'sendTextMessage', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }

  // Enviar mensaje con imagen
  async sendImageMessage(req, res) {
    try {
      const { conversationId } = req.params
      const { caption, replyTo } = req.body

      if (!req.files || !req.files.image) {
        return this.sendError(res, 'La imagen es obligatoria', 400)
      }

      // Verificar que la conversación existe y el usuario es participante
      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      if (!conversation.participants.includes(req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
      const imageFile = req.files.image[0]

      // Crear el mensaje
      const messageData = {
        conversation: conversationId,
        sender: req.user.id,
        type: 'image',
        content: {
          image: {
            url: `${baseUrl}/uploads/${imageFile.filename}`,
            alt: caption || '',
            width: 0,
            height: 0
          },
          caption: caption || ''
        }
      }

      if (replyTo) {
        messageData.replyTo = replyTo
      }

      const message = new Message(messageData)
      await message.save()

      // Poblar el mensaje con datos del sender
      await message.populate('sender', 'username avatar fullName')

      // Emitir mensaje en tiempo real
      socketService.emitToConversation(conversationId, 'new_message', {
        message: message.toObject()
      })

      // Crear notificaciones para otros participantes
      const otherParticipants = conversation.participants.filter(
        p => p.toString() !== req.user.id
      )

      for (const participantId of otherParticipants) {
        await Notification.create({
          user: participantId,
          type: 'message',
          title: 'Nueva imagen',
          message: `${req.user.username} envió una imagen`,
          data: {
            conversationId,
            messageId: message._id,
            senderId: req.user.id
          }
        })

        // Emitir notificación en tiempo real
        socketService.emitToUser(participantId, 'notification', {
          type: 'message',
          title: 'Nueva imagen',
          message: `${req.user.username} envió una imagen`
        })
      }

      logger.info('Mensaje con imagen enviado exitosamente', {
        messageId: message._id,
        conversationId,
        senderId: req.user.id
      })

      return this.sendSuccess(res, message, 'Imagen enviada exitosamente', 201)

    } catch (error) {
      return this.handleError(error, res, 'sendImageMessage', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }

  // Editar mensaje
  async editMessage(req, res) {
    try {
      const { messageId } = req.params
      const { content } = req.body

      if (!content || content.trim().length === 0) {
        return this.sendError(res, 'El contenido del mensaje no puede estar vacío', 400)
      }

      const message = await Message.findById(messageId)
      if (!message) {
        return this.sendError(res, 'Mensaje no encontrado', 404)
      }

      // Verificar que el usuario es el sender
      if (message.sender.toString() !== req.user.id) {
        return this.sendError(res, 'No tienes permisos para editar este mensaje', 403)
      }

      // Verificar que el mensaje no es muy antiguo (máximo 15 minutos)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
      if (message.createdAt < fifteenMinutesAgo) {
        return this.sendError(res, 'No puedes editar mensajes después de 15 minutos', 400)
      }

      // Actualizar el mensaje
      message.content = content.trim()
      message.isEdited = true
      message.editedAt = new Date()
      await message.save()

      // Emitir actualización en tiempo real
      socketService.emitToConversation(message.conversation.toString(), 'message_edited', {
        messageId: message._id,
        content: message.content,
        editedAt: message.editedAt
      })

      logger.info('Mensaje editado exitosamente', {
        messageId: message._id,
        userId: req.user.id
      })

      return this.sendSuccess(res, message, 'Mensaje editado exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'editMessage', {
        messageId: req.params?.messageId,
        userId: req.user?.id
      })
    }
  }

  // Eliminar mensaje
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params

      const message = await Message.findById(messageId)
      if (!message) {
        return this.sendError(res, 'Mensaje no encontrado', 404)
      }

      // Verificar que el usuario es el sender
      if (message.sender.toString() !== req.user.id) {
        return this.sendError(res, 'No tienes permisos para eliminar este mensaje', 403)
      }

      // Marcar como eliminado
      message.isDeleted = true
      message.deletedAt = new Date()
      await message.save()

      // Emitir eliminación en tiempo real
      socketService.emitToConversation(message.conversation.toString(), 'message_deleted', {
        messageId: message._id
      })

      logger.info('Mensaje eliminado exitosamente', {
        messageId: message._id,
        userId: req.user.id
      })

      return this.sendSuccess(res, null, 'Mensaje eliminado exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'deleteMessage', {
        messageId: req.params?.messageId,
        userId: req.user?.id
      })
    }
  }

  // Buscar mensajes
  async searchMessages(req, res) {
    try {
      const { conversationId } = req.params
      const { query, page = 1, limit = 20 } = req.query
      const skip = (page - 1) * limit

      if (!query || query.trim().length === 0) {
        return this.sendError(res, 'El término de búsqueda es obligatorio', 400)
      }

      // Verificar que la conversación existe y el usuario es participante
      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      if (!conversation.participants.includes(req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      // Buscar mensajes
      const messages = await Message.find({
        conversation: conversationId,
        content: { $regex: query, $options: 'i' },
        isDeleted: false
      })
        .populate('sender', 'username avatar fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()

      const total = await Message.countDocuments({
        conversation: conversationId,
        content: { $regex: query, $options: 'i' },
        isDeleted: false
      })

      const responseData = {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }

      return this.sendSuccess(res, responseData, 'Búsqueda completada exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'searchMessages', {
        conversationId: req.params?.conversationId,
        query: req.query?.query,
        userId: req.user?.id
      })
    }
  }

  // Obtener estadísticas de mensajes
  async getMessageStats(req, res) {
    try {
      const { conversationId } = req.params

      // Verificar que la conversación existe y el usuario es participante
      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      if (!conversation.participants.includes(req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      // Obtener estadísticas
      const totalMessages = await Message.countDocuments({
        conversation: conversationId,
        isDeleted: false
      })

      const unreadMessages = await Message.countDocuments({
        conversation: conversationId,
        isDeleted: false,
        readBy: { $ne: req.user.id }
      })

      const stats = {
        totalMessages,
        unreadMessages,
        participants: conversation.participants.length
      }

      return this.sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getMessageStats', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }
}

// Crear instancia del controlador
const messageController = new MessageController()

export { messageController, MessageController }
