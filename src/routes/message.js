const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  sendMessage,
  getMessages
} = require('../controllers/messageController');

// Enviar mensaje
router.post('/', auth, sendMessage);
// Listar mensajes de una conversación
router.get('/:conversationId', auth, getMessages);

module.exports = router;
