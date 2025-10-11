import express from 'express'
const router = express.Router()
import {
  cleanupOldNotifications,
  createNotification,
  deleteNotification,
  deleteReadNotifications,
  getNotifications,
  getNotificationStats,
  getUnreadCount,
  markAllAsRead,
  markAsRead
} from '../controllers/notificationController.js'
import { auth } from '../middlewares/auth.js'
import { validate } from '../middlewares/validate.js'
import { createNotificationSchema } from '../schemas/notificationSchema.js'

// Rutas protegidas
router.get('/', auth, getNotifications)
router.get('/unread/count', auth, getUnreadCount)
router.get('/stats', auth, getNotificationStats)

router.put('/:id/read', auth, markAsRead)
router.put('/read-all', auth, markAllAsRead)

router.delete('/:id', auth, deleteNotification)
router.delete('/read-all', auth, deleteReadNotifications)

// Rutas administrativas (para testing o casos especiales)
router.post('/', auth, validate(createNotificationSchema), createNotification)
router.post('/cleanup-old', auth, cleanupOldNotifications)

export default router
