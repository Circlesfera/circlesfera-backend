import express from 'express'
const router = express.Router()
import { body } from 'express-validator'
import {
  getUserProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUserSuggestions,
  getUserSettings,
  updatePrivacySettings,
  updateNotificationSettings,
  updateSecuritySettings,
  changePassword,
  toggleTwoFactor,
  muteUser,
  unmuteUser,
  restrictUser,
  unrestrictUser
} from '../controllers/userController.js'
import { auth, optionalAuth } from '../middlewares/auth.js'

// Validaciones
const searchValidation = [
  body('q')
    .isLength({ min: 2 })
    .withMessage('El término de búsqueda debe tener al menos 2 caracteres')
]


// Rutas públicas
router.get('/search', searchValidation, searchUsers)

// Rutas que pueden ser públicas o privadas (con autenticación opcional)
router.get('/profile/:username', optionalAuth, getUserProfile)
router.get('/:userId/followers', optionalAuth, getFollowers)
router.get('/:userId/following', optionalAuth, getFollowing)

// Rutas protegidas
router.post('/:userId/follow', auth, followUser)
router.delete('/:userId/follow', auth, unfollowUser)
router.post('/:userId/block', auth, blockUser)
router.delete('/:userId/block', auth, unblockUser)
router.post('/:userId/mute', auth, muteUser)
router.delete('/:userId/mute', auth, unmuteUser)
router.post('/:userId/restrict', auth, restrictUser)
router.delete('/:userId/restrict', auth, unrestrictUser)
router.get('/blocked/list', auth, getBlockedUsers)
router.get('/suggestions', auth, getUserSuggestions)

// Rutas para configuraciones
router.get('/settings', auth, getUserSettings)
router.put('/settings/privacy', auth, updatePrivacySettings)
router.put('/settings/notifications', auth, updateNotificationSettings)
router.put('/settings/security', auth, updateSecuritySettings)
router.put('/change-password', auth, changePassword)
router.put('/two-factor', auth, toggleTwoFactor)

export default router
