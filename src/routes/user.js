import express from 'express'
const router = express.Router()
import {
  blockUser,
  changeUserRole,
  followUser,
  getBlockedUsers,
  getFollowers,
  getFollowing,
  getUserProfile,
  getUserSettings,
  getUserSuggestions,
  muteUser,
  restrictUser,
  searchUsers,
  toggleTwoFactor,
  unblockUser,
  unfollowUser,
  unmuteUser,
  unrestrictUser,
  updateNotificationSettings,
  updatePrivacySettings,
  updateSecuritySettings
} from '../controllers/userController.js'
import { changeRoleSchema } from '../schemas/userSchema.js'
import { auth, optionalAuth } from '../middlewares/auth.js'
import { checkRole } from '../middlewares/checkRole.js'
import { csrfProtection } from '../middlewares/csrf.js'
import { validate } from '../middlewares/validate.js'

// Rutas públicas
router.get('/search', searchUsers)

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
router.put('/two-factor', auth, toggleTwoFactor)

// Rutas de administración (solo admin)
router.put('/:userId/role', auth, csrfProtection(), checkRole(['admin']), validate(changeRoleSchema), changeUserRole)

export default router
