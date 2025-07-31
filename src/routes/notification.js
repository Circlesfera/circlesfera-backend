const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  createNotification,
  getNotificationStats,
  cleanupOldNotifications
} = require('../controllers/notificationController');
const { auth } = require('../middlewares/auth');

// Validaciones
const createNotificationValidation = [
  body('userId')
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  body('fromUserId')
    .isMongoId()
    .withMessage('ID de usuario que genera la notificación inválido'),
  body('type')
    .isIn([
      'follow', 'unfollow', 'like', 'comment', 'comment_like',
      'story', 'story_reply', 'mention', 'post_share',
      'account_update', 'security_alert'
    ])
    .withMessage('Tipo de notificación no válido'),
  body('title')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El título no puede exceder 100 caracteres'),
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('El mensaje no puede exceder 500 caracteres')
];

// Rutas protegidas
router.get('/', auth, getNotifications);
router.get('/unread/count', auth, getUnreadCount);
router.get('/stats', auth, getNotificationStats);

router.put('/:id/read', auth, markAsRead);
router.put('/read/all', auth, markAllAsRead);

router.delete('/:id', auth, deleteNotification);
router.delete('/read/all', auth, deleteReadNotifications);

// Rutas administrativas (para testing o casos especiales)
router.post('/', auth, createNotificationValidation, createNotification);
router.post('/cleanup/old', auth, cleanupOldNotifications);

module.exports = router;
