const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getUserProfile,
  getUserPosts,
  getUserStories,
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
} = require('../controllers/userController');
const { auth } = require('../middlewares/auth');

// Validaciones
const searchValidation = [
  body('q')
    .isLength({ min: 2 })
    .withMessage('El término de búsqueda debe tener al menos 2 caracteres'),
];


// Rutas públicas
router.get('/profile/:username', getUserProfile);
router.get('/:username/posts', getUserPosts);
router.get('/:username/stories', getUserStories);
router.get('/:username/followers', getFollowers);
router.get('/:username/following', getFollowing);
router.get('/search', searchValidation, searchUsers);

// Rutas protegidas
router.post('/:username/follow', auth, followUser);
router.delete('/:username/follow', auth, unfollowUser);
router.post('/:username/block', auth, blockUser);
router.delete('/:username/block', auth, unblockUser);
router.get('/blocked/list', auth, getBlockedUsers);
router.get('/suggestions', auth, getUserSuggestions);

// Rutas para configuraciones
router.get('/settings', auth, getUserSettings);
router.put('/settings/privacy', auth, updatePrivacySettings);
router.put('/settings/notifications', auth, updateNotificationSettings);
router.put('/settings/security', auth, updateSecuritySettings);
router.put('/change-password', auth, changePassword);
router.put('/two-factor', auth, toggleTwoFactor);

module.exports = router;
