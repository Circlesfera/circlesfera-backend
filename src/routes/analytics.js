import express from 'express'
const router = express.Router()
import {
  cleanup,
  getDashboardStats,
  getStats,
  getUserAnalytics,
  trackEvent
} from '../controllers/analyticsController.js'
import { auth, optionalAuth } from '../middlewares/auth.js'
import { checkRole } from '../middlewares/checkRole.js'

// Rutas públicas (con auth opcional)
router.post('/event', optionalAuth, trackEvent)

// Rutas protegidas
router.get('/stats', auth, getStats)
router.get('/user/:userId', auth, getUserAnalytics)
router.delete('/cleanup', auth, checkRole(['admin']), cleanup)

// Ruta de dashboard (admin/moderator)
router.get('/dashboard', auth, checkRole(['admin', 'moderator']), getDashboardStats)

export default router
