const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Crear o recuperar conversación entre dos usuarios
exports.createOrGetConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetId } = req.body;
    if (userId === targetId) return res.status(400).json({ message: 'No puedes chatear contigo mismo' });
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, targetId], $size: 2 }
    });
    if (!conversation) {
      conversation = new Conversation({ participants: [userId, targetId] });
      await conversation.save();
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear/obtener conversación', error: error.message });
  }
};

// Listar conversaciones del usuario
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'username avatar')
      .populate({ path: 'lastMessage', select: 'text sender createdAt read' })
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener conversaciones', error: error.message });
  }
};
