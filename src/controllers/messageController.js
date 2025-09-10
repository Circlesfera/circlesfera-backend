const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// Obtener mensajes de una conversación
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    const messages = await Message.findByConversation(conversationId, { skip, limit })
      .populate('sender', 'username avatar fullName')
      .populate('replyTo', 'content sender createdAt')
      .sort({ createdAt: -1 });

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false,
    });

    // Marcar mensajes como leídos
    await Message.markConversationAsRead(conversationId, req.user.id);

    res.json({
      success: true,
      messages: messages.reverse(), // Ordenar por fecha ascendente
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error en getMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Enviar mensaje de texto
exports.sendTextMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, replyTo } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El contenido del mensaje no puede estar vacío',
      });
    }

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    // Crear el mensaje
    const message = new Message({
      conversation: conversationId,
      sender: req.user.id,
      type: 'text',
      content: {
        text: content.trim(),
      },
      replyTo: replyTo || undefined,
    });

    await message.save();
    await message.populate('sender', 'username avatar fullName');
    await message.populate('replyTo', 'content sender createdAt');

    // Actualizar último mensaje de la conversación
    await conversation.updateLastMessage(message);

    // Enviar notificaciones a otros participantes
    const otherParticipants = conversation.participants.filter(p => p.toString() !== req.user.id);
    for (const participantId of otherParticipants) {
      await Notification.create({
        user: participantId,
        from: req.user.id,
        type: 'message',
        title: 'Nuevo mensaje',
        message: `${req.user.username} te envió un mensaje`,
        data: {
          conversation: conversationId,
          message: message._id,
        },
      });
    }

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error en sendTextMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Enviar mensaje de imagen
exports.sendImageMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { caption } = req.body;
    const imageFile = req.files?.image;

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere una imagen',
      });
    }

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    // Crear el mensaje
    const message = new Message({
      conversation: conversationId,
      sender: req.user.id,
      type: 'image',
      content: {
        image: {
          url: imageFile.path,
          alt: caption || 'Imagen',
          width: imageFile.width,
          height: imageFile.height,
        },
      },
    });

    await message.save();
    await message.populate('sender', 'username avatar fullName');

    // Actualizar último mensaje de la conversación
    await conversation.updateLastMessage(message);

    // Enviar notificaciones
    const otherParticipants = conversation.participants.filter(p => p.toString() !== req.user.id);
    for (const participantId of otherParticipants) {
      await Notification.create({
        user: participantId,
        from: req.user.id,
        type: 'message',
        title: 'Nueva imagen',
        message: `${req.user.username} te envió una imagen`,
        data: {
          conversation: conversationId,
          message: message._id,
        },
      });
    }

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error en sendImageMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Enviar mensaje de video
exports.sendVideoMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { caption } = req.body;
    const videoFile = req.files?.video;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un video',
      });
    }

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    // Crear el mensaje
    const message = new Message({
      conversation: conversationId,
      sender: req.user.id,
      type: 'video',
      content: {
        video: {
          url: videoFile.path,
          duration: videoFile.duration || 0,
          thumbnail: videoFile.thumbnail || '',
          width: videoFile.width,
          height: videoFile.height,
        },
      },
    });

    await message.save();
    await message.populate('sender', 'username avatar fullName');

    // Actualizar último mensaje de la conversación
    await conversation.updateLastMessage(message);

    // Enviar notificaciones
    const otherParticipants = conversation.participants.filter(p => p.toString() !== req.user.id);
    for (const participantId of otherParticipants) {
      await Notification.create({
        user: participantId,
        from: req.user.id,
        type: 'message',
        title: 'Nuevo video',
        message: `${req.user.username} te envió un video`,
        data: {
          conversation: conversationId,
          message: message._id,
        },
      });
    }

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error en sendVideoMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Enviar mensaje de ubicación
exports.sendLocationMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { latitude, longitude, name, address } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren coordenadas de ubicación',
      });
    }

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    // Crear el mensaje
    const message = new Message({
      conversation: conversationId,
      sender: req.user.id,
      type: 'location',
      content: {
        location: {
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
          name: name || 'Ubicación',
          address: address || '',
        },
      },
    });

    await message.save();
    await message.populate('sender', 'username avatar fullName');

    // Actualizar último mensaje de la conversación
    await conversation.updateLastMessage(message);

    // Enviar notificaciones
    const otherParticipants = conversation.participants.filter(p => p.toString() !== req.user.id);
    for (const participantId of otherParticipants) {
      await Notification.create({
        user: participantId,
        from: req.user.id,
        type: 'message',
        title: 'Nueva ubicación',
        message: `${req.user.username} compartió su ubicación`,
        data: {
          conversation: conversationId,
          message: message._id,
        },
      });
    }

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error en sendLocationMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Editar mensaje
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El contenido del mensaje no puede estar vacío',
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado',
      });
    }

    // Verificar que el usuario es el remitente
    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes editar tus propios mensajes',
      });
    }

    // Solo se pueden editar mensajes de texto
    if (message.type !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden editar mensajes de texto',
      });
    }

    // Verificar que el mensaje no es muy antiguo (máximo 15 minutos)
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    if (messageAge > 15 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden editar mensajes de los últimos 15 minutos',
      });
    }

    await message.edit(content.trim());
    await message.populate('sender', 'username avatar fullName');

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error en editMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Eliminar mensaje
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado',
      });
    }

    // Verificar que el usuario es el remitente o admin de la conversación
    const conversation = await Conversation.findById(message.conversation);
    const isSender = message.sender.toString() === req.user.id;
    const isAdmin = conversation.type === 'group' && conversation.admins.includes(req.user.id);

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este mensaje',
      });
    }

    await message.softDelete();

    res.json({
      success: true,
      message: 'Mensaje eliminado',
    });
  } catch (error) {
    console.error('Error en deleteMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Reenviar mensaje
exports.forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationIds } = req.body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren IDs de conversaciones válidos',
      });
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje original no encontrado',
      });
    }

    // Verificar que el usuario es participante de las conversaciones destino
    const conversations = await Conversation.find({
      _id: { $in: conversationIds },
      participants: req.user.id,
    });

    if (conversations.length !== conversationIds.length) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a todas las conversaciones especificadas',
      });
    }

    const forwardedMessages = [];

    for (const conversation of conversations) {
      const forwardedMessage = new Message({
        conversation: conversation._id,
        sender: req.user.id,
        type: originalMessage.type,
        content: originalMessage.content,
        isForwarded: true,
        originalMessage: originalMessage._id,
      });

      await forwardedMessage.save();
      await forwardedMessage.populate('sender', 'username avatar fullName');

      // Actualizar último mensaje de la conversación
      await conversation.updateLastMessage(forwardedMessage);

      // Enviar notificaciones
      const otherParticipants = conversation.participants.filter(p => p.toString() !== req.user.id);
      for (const participantId of otherParticipants) {
        await Notification.create({
          user: participantId,
          from: req.user.id,
          type: 'message',
          title: 'Mensaje reenviado',
          message: `${req.user.username} reenvió un mensaje`,
          data: {
            conversation: conversation._id,
            message: forwardedMessage._id,
          },
        });
      }

      forwardedMessages.push(forwardedMessage);
    }

    res.json({
      success: true,
      messages: forwardedMessages,
    });
  } catch (error) {
    console.error('Error en forwardMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Buscar mensajes
exports.searchMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { query } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El término de búsqueda debe tener al menos 2 caracteres',
      });
    }

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    const messages = await Message.searchMessages(conversationId, query, { skip, limit })
      .populate('sender', 'username avatar fullName');

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false,
      $or: [
        { 'content.text': { $regex: query, $options: 'i' } },
        { 'content.image.alt': { $regex: query, $options: 'i' } },
      ],
    });

    res.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error en searchMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener estadísticas de mensajes
exports.getMessageStats = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verificar que la conversación existe y el usuario es participante
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversación no encontrada',
      });
    }

    if (!conversation.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta conversación',
      });
    }

    const stats = await Message.getMessageStats(conversationId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error en getMessageStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};
