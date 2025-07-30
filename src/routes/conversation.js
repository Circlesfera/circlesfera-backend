const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  createOrGetConversation,
  getConversations
} = require('../controllers/conversationController');

// Crear o recuperar conversación entre dos usuarios
router.post('/', auth, createOrGetConversation);
// Listar conversaciones del usuario
router.get('/', auth, getConversations);

module.exports = router;
