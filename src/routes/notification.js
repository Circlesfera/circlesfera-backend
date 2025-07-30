const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  getNotifications,
  markAsRead
} = require('../controllers/notificationController');

// Listar notificaciones del usuario (protegido)
router.get('/', auth, getNotifications);
// Marcar notificación como leída (protegido)
router.put('/:id/read', auth, markAsRead);

module.exports = router;
