/**
 * 💬 REFACTORED CONVERSATION CONTROLLER
 * =====================================
 * Controlador de conversaciones refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import Conversation from '../models/Conversation.js'
import User from '../models/User.js'
import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import socketService from '../services/socketService.js'
import logger from '../utils/logger.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class ConversationController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para crear conversación directa
  static createDirectConversationValidations = [
    body('participantId')
      .isMongoId()
      .withMessage('ID de participante inválido')
  ]

  // Validaciones específicas para crear conversación grupal
  static createGroupConversationValidations = [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
    body('participants')
      .isArray({ min: 1, max: 50 })
      .withMessage('Debe tener entre 1 y 50 participantes'),
    body('participants.*')
      .isMongoId()
      .withMessage('ID de participante inválido')
  ]

  // Obtener conversaciones del usuario
  async getConversations(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query
      const skip = (page - 1) * limit

      const conversations = await Conversation.findByUser(req.user.id, { skip, limit })
        .populate('participants', 'username avatar fullName')
        .populate('lastMessage')
        .sort({ updatedAt: -1 })

      const total = await Conversation.countDocuments({
        participants: req.user.id,
        'settings.isDeleted': false
      })

      const responseData = {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }

      return this.sendSuccess(res, responseData, 'Conversaciones obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getConversations', {
        userId: req.user?.id
      })
    }
  }

  // Obtener una conversación específica
  async getConversation(req, res) {
    try {
      const { conversationId } = req.params

      const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'username avatar fullName')
        .populate('lastMessage')
        .populate('admins', 'username avatar fullName')

      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      // Verificar que el usuario es participante
      if (!conversation.participants.some(p => p._id.toString() === req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      return this.sendSuccess(res, conversation, 'Conversación obtenida exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getConversation', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }

  // Crear conversación directa
  async createDirectConversation(req, res) {
    try {
      const { participantId } = req.body

      if (participantId === req.user.id) {
        return this.sendError(res, 'No puedes crear una conversación contigo mismo', 400)
      }

      // Verificar que el usuario existe
      const participant = await User.findById(participantId)
      if (!participant) {
        return this.sendError(res, 'Usuario no encontrado', 404)
      }

      // Verificar si ya existe una conversación directa
      const existingConversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [req.user.id, participantId] }
      })

      if (existingConversation) {
        return this.sendSuccess(res, existingConversation, 'Conversación directa ya existe')
      }

      // Crear nueva conversación directa
      const conversation = new Conversation({
        type: 'direct',
        participants: [req.user.id, participantId],
        createdBy: req.user.id
      })

      await conversation.save()

      // Poblar la conversación
      await conversation.populate('participants', 'username avatar fullName')

      // Emitir evento en tiempo real
      socketService.emitToUser(participantId, 'conversation_created', {
        conversation: conversation.toObject()
      })

      logger.info('Conversación directa creada exitosamente', {
        conversationId: conversation._id,
        participants: [req.user.id, participantId]
      })

      return this.sendSuccess(res, conversation, 'Conversación directa creada exitosamente', 201)

    } catch (error) {
      return this.handleError(error, res, 'createDirectConversation', {
        participantId: req.body?.participantId,
        userId: req.user?.id
      })
    }
  }

  // Crear conversación grupal
  async createGroupConversation(req, res) {
    try {
      const { name, participants, description } = req.body

      // Verificar que no se incluya al usuario actual en los participantes
      const filteredParticipants = participants.filter(p => p !== req.user.id)
      const allParticipants = [req.user.id, ...filteredParticipants]

      // Verificar que todos los participantes existen
      const existingUsers = await User.find({
        _id: { $in: filteredParticipants }
      }).select('_id')

      if (existingUsers.length !== filteredParticipants.length) {
        return this.sendError(res, 'Uno o más usuarios no existen', 400)
      }

      // Crear nueva conversación grupal
      const conversation = new Conversation({
        type: 'group',
        name,
        description: description || '',
        participants: allParticipants,
        admins: [req.user.id],
        createdBy: req.user.id
      })

      await conversation.save()

      // Poblar la conversación
      await conversation.populate('participants', 'username avatar fullName')
      await conversation.populate('admins', 'username avatar fullName')

      // Emitir evento en tiempo real a todos los participantes
      for (const participantId of filteredParticipants) {
        socketService.emitToUser(participantId, 'conversation_created', {
          conversation: conversation.toObject()
        })

        // Crear notificación
        await Notification.create({
          user: participantId,
          type: 'conversation',
          title: 'Nueva conversación grupal',
          message: `Te agregaron al grupo "${name}"`,
          data: {
            conversationId: conversation._id,
            type: 'group'
          }
        })
      }

      logger.info('Conversación grupal creada exitosamente', {
        conversationId: conversation._id,
        name,
        participants: allParticipants
      })

      return this.sendSuccess(res, conversation, 'Conversación grupal creada exitosamente', 201)

    } catch (error) {
      return this.handleError(error, res, 'createGroupConversation', {
        name: req.body?.name,
        participants: req.body?.participants,
        userId: req.user?.id
      })
    }
  }

  // Agregar participante a conversación grupal
  async addParticipant(req, res) {
    try {
      const { conversationId } = req.params
      const { participantId } = req.body

      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      // Verificar que es una conversación grupal
      if (conversation.type !== 'group') {
        return this.sendError(res, 'Solo se pueden agregar participantes a conversaciones grupales', 400)
      }

      // Verificar que el usuario es admin
      if (!conversation.admins.includes(req.user.id)) {
        return this.sendError(res, 'No tienes permisos para agregar participantes', 403)
      }

      // Verificar que el usuario existe
      const participant = await User.findById(participantId)
      if (!participant) {
        return this.sendError(res, 'Usuario no encontrado', 404)
      }

      // Verificar que no esté ya en la conversación
      if (conversation.participants.includes(participantId)) {
        return this.sendError(res, 'El usuario ya está en la conversación', 400)
      }

      // Agregar participante
      conversation.participants.push(participantId)
      await conversation.save()

      // Poblar el participante agregado
      await conversation.populate('participants', 'username avatar fullName')

      // Emitir evento en tiempo real
      socketService.emitToUser(participantId, 'conversation_updated', {
        conversation: conversation.toObject(),
        action: 'added'
      })

      socketService.emitToConversation(conversationId, 'participant_added', {
        participant: participant.toObject(),
        addedBy: req.user.id
      })

      // Crear notificación
      await Notification.create({
        user: participantId,
        type: 'conversation',
        title: 'Te agregaron a un grupo',
        message: `Te agregaron al grupo "${conversation.name}"`,
        data: {
          conversationId: conversation._id,
          type: 'group'
        }
      })

      logger.info('Participante agregado exitosamente', {
        conversationId,
        participantId,
        addedBy: req.user.id
      })

      return this.sendSuccess(res, conversation, 'Participante agregado exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'addParticipant', {
        conversationId: req.params?.conversationId,
        participantId: req.body?.participantId,
        userId: req.user?.id
      })
    }
  }

  // Remover participante de conversación grupal
  async removeParticipant(req, res) {
    try {
      const { conversationId, participantId } = req.params

      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      // Verificar que es una conversación grupal
      if (conversation.type !== 'group') {
        return this.sendError(res, 'Solo se pueden remover participantes de conversaciones grupales', 400)
      }

      // Verificar que el usuario es admin o se está removiendo a sí mismo
      const isAdmin = conversation.admins.includes(req.user.id)
      const isSelfRemoval = participantId === req.user.id

      if (!isAdmin && !isSelfRemoval) {
        return this.sendError(res, 'No tienes permisos para remover participantes', 403)
      }

      // Verificar que el participante está en la conversación
      if (!conversation.participants.includes(participantId)) {
        return this.sendError(res, 'El usuario no está en la conversación', 400)
      }

      // Remover participante
      conversation.participants = conversation.participants.filter(
        p => p.toString() !== participantId
      )

      // Si es admin, removerlo también de admins
      if (conversation.admins.includes(participantId)) {
        conversation.admins = conversation.admins.filter(
          a => a.toString() !== participantId
        )
      }

      await conversation.save()

      // Emitir evento en tiempo real
      socketService.emitToUser(participantId, 'conversation_updated', {
        conversation: conversation.toObject(),
        action: 'removed'
      })

      socketService.emitToConversation(conversationId, 'participant_removed', {
        participantId,
        removedBy: req.user.id
      })

      logger.info('Participante removido exitosamente', {
        conversationId,
        participantId,
        removedBy: req.user.id
      })

      return this.sendSuccess(res, conversation, 'Participante removido exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'removeParticipant', {
        conversationId: req.params?.conversationId,
        participantId: req.params?.participantId,
        userId: req.user?.id
      })
    }
  }

  // Eliminar conversación
  async deleteConversation(req, res) {
    try {
      const { conversationId } = req.params

      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      // Verificar que el usuario es participante
      if (!conversation.participants.includes(req.user.id)) {
        return this.sendError(res, 'No tienes acceso a esta conversación', 403)
      }

      // Para conversaciones grupales, solo el creador puede eliminarlas
      if (conversation.type === 'group' && conversation.createdBy.toString() !== req.user.id) {
        return this.sendError(res, 'Solo el creador puede eliminar la conversación', 403)
      }

      // Marcar como eliminada
      conversation.settings.isDeleted = true
      conversation.deletedAt = new Date()
      conversation.deletedBy = req.user.id
      await conversation.save()

      // Emitir evento en tiempo real
      socketService.emitToConversation(conversationId, 'conversation_deleted', {
        deletedBy: req.user.id
      })

      logger.info('Conversación eliminada exitosamente', {
        conversationId,
        deletedBy: req.user.id
      })

      return this.sendSuccess(res, null, 'Conversación eliminada exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'deleteConversation', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }

  // Obtener estadísticas de conversación
  async getConversationStats(req, res) {
    try {
      const { conversationId } = req.params

      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        return this.sendError(res, 'Conversación no encontrada', 404)
      }

      // Verificar que el usuario es participante
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
        participants: conversation.participants.length,
        type: conversation.type,
        createdAt: conversation.createdAt
      }

      return this.sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente')

    } catch (error) {
      return this.handleError(error, res, 'getConversationStats', {
        conversationId: req.params?.conversationId,
        userId: req.user?.id
      })
    }
  }
}

// Crear instancia del controlador
const conversationController = new ConversationController()

export { conversationController, ConversationController }
