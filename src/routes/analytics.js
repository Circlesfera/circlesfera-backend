import express from 'express'
const router = express.Router()
import {
  cleanup,
  getStats,
  getUserAnalytics,
  trackEvent
} from '../controllers/analyticsController.js'
import { auth, optionalAuth } from '../middlewares/auth.js'

// Rutas públicas (con auth opcional)
router.post('/event', optionalAuth, trackEvent)

// Rutas protegidas
router.get('/stats', auth, getStats)
router.get('/user/:userId', auth, getUserAnalytics)
router.delete('/cleanup', auth, cleanup)

export default router
