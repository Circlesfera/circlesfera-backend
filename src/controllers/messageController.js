const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Enviar mensaje
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, text } = req.body;
    if (!text) return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
    const message = new Message({
      conversation: conversationId,
      sender: req.user.id,
      text
    });
    await message.save();
    // Actualizar lastMessage en la conversación
    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id, updatedAt: Date.now() });
    res.status(201).json({ message: 'Mensaje enviado', data: message });
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar mensaje', error: error.message });
  }
};

// Listar mensajes de una conversación
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener mensajes', error: error.message });
  }
};
