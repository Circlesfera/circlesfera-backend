import Conversation from '../models/Conversation.js'
import User from '../models/User.js'
import logger from '../utils/logger.js'

// Obtener conversaciones del usuario
export const getConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const conversations = await Conversation.findByUser(req.user.id, { skip, limit })
      .populate('participants', 'username avatar fullName')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })

    const total = await Conversation.countDocuments({
      participants: req.user.id,
      isDeleted: false
    })

    res.json({
      success: true,
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getConversations:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener una conversación específica
export const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params

    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username avatar fullName')
      .populate('lastMessage')
      .populate('admins', 'username avatar fullName')

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que el usuario es participante
    if (!conversation.participants.some(p => p._id.toString() === req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación'
      })
    }

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en getConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Crear conversación directa
export const createDirectConversation = async (req, res) => {
  try {
    const { participantId } = req.body

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el ID del participante'
      })
    }

    if (participantId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes crear una conversación contigo mismo'
      })
    }

    // Verificar que el usuario existe
    const participant = await User.findById(participantId)
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Buscar o crear conversación directa
    let conversation = await Conversation.findOrCreateDirectConversation(req.user.id, participantId)

    // Populate participantes
    conversation = await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en createDirectConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Crear conversación grupal
export const createGroupConversation = async (req, res) => {
  try {
    const { name, description, participantIds } = req.body

    if (!name || !participantIds || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere nombre y al menos un participante'
      })
    }

    // Verificar que todos los usuarios existen
    const participants = await User.find({ _id: { $in: participantIds } })
    if (participants.length !== participantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Algunos usuarios no existen'
      })
    }

    // Crear conversación grupal
    const conversation = new Conversation({
      type: 'group',
      name,
      description,
      participants: [req.user.id, ...participantIds],
      admins: [req.user.id]
    })

    await conversation.save()
    await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en createGroupConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Agregar participante a conversación grupal
export const addParticipant = async (req, res) => {
  try {
    const { conversationId } = req.params
    const { participantId } = req.body

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que es conversación grupal
    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden agregar participantes a conversaciones grupales'
      })
    }

    // Verificar que el usuario es admin
    if (!conversation.admins.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden agregar participantes'
      })
    }

    await conversation.addParticipant(participantId)
    await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en addParticipant:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Remover participante de conversación grupal
export const removeParticipant = async (req, res) => {
  try {
    const { conversationId } = req.params
    const { participantId } = req.body

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que es conversación grupal
    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden remover participantes de conversaciones grupales'
      })
    }

    // Verificar que el usuario es admin
    if (!conversation.admins.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden remover participantes'
      })
    }

    await conversation.removeParticipant(participantId)
    await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en removeParticipant:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Agregar administrador
export const addAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params
    const { adminId } = req.body

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que es conversación grupal
    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Solo las conversaciones grupales tienen administradores'
      })
    }

    // Verificar que el usuario es admin
    if (!conversation.admins.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden agregar otros administradores'
      })
    }

    await conversation.addAdmin(adminId)
    await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en addAdmin:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Remover administrador
export const removeAdmin = async (req, res) => {
  try {
    const { conversationId } = req.params
    const { adminId } = req.body

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que es conversación grupal
    if (conversation.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Solo las conversaciones grupales tienen administradores'
      })
    }

    // Verificar que el usuario es admin
    if (!conversation.admins.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden remover otros administradores'
      })
    }

    await conversation.removeAdmin(adminId)
    await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en removeAdmin:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar configuración de conversación
export const updateConversation = async (req, res) => {
  try {
    const { conversationId } = req.params
    const { name, description, avatar } = req.body

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que el usuario es participante
    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación'
      })
    }

    // Para conversaciones grupales, verificar que es admin
    if (conversation.type === 'group' && !conversation.admins.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden actualizar la conversación'
      })
    }

    // Actualizar campos
    if (name) { conversation.name = name }
    if (description) { conversation.description = description }
    if (avatar) { conversation.avatar = avatar }

    await conversation.save()
    await conversation.populate('participants', 'username avatar fullName')

    res.json({
      success: true,
      conversation
    })
  } catch (error) {
    logger.error('Error en updateConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Archivar conversación
export const archiveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que el usuario es participante
    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación'
      })
    }

    await conversation.archive()

    res.json({
      success: true,
      message: 'Conversación archivada'
    })
  } catch (error) {
    logger.error('Error en archiveConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Desarchivar conversación
export const unarchiveConversation = async (req, res) => {
  try {
    const { conversationId } = req.params

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que el usuario es participante
    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación'
      })
    }

    await conversation.unarchive()

    res.json({
      success: true,
      message: 'Conversación desarchivada'
    })
  } catch (error) {
    logger.error('Error en unarchiveConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar conversación (soft delete)
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params

    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada'
      })
    }

    // Verificar que el usuario es participante
    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación'
      })
    }

    await conversation.softDelete()

    res.json({
      success: true,
      message: 'Conversación eliminada'
    })
  } catch (error) {
    logger.error('Error en deleteConversation:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener estadísticas de conversaciones
export const getConversationStats = async (req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments({
      participants: req.user.id,
      isDeleted: false
    })

    const unreadCount = await Conversation.getUnreadCount(req.user.id)

    const recentConversations = await Conversation.findByUser(req.user.id, { skip: 0, limit: 5 })
      .populate('participants', 'username avatar fullName')
      .populate('lastMessage')

    res.json({
      success: true,
      stats: {
        totalConversations,
        unreadCount,
        recentConversations
      }
    })
  } catch (error) {
    logger.error('Error en getConversationStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
