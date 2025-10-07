const express = require('express')
const router = express.Router()
const {
  trackEvent,
  getStats,
  getUserAnalytics,
  cleanup
} = require('../controllers/analyticsController')
const { auth, optionalAuth } = require('../middlewares/auth')

// Rutas públicas (con auth opcional)
router.post('/event', optionalAuth, trackEvent)

// Rutas protegidas
router.get('/stats', auth, getStats)
router.get('/user/:userId', auth, getUserAnalytics)
router.delete('/cleanup', auth, cleanup)

module.exports = router
