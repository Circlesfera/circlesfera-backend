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
  getUserSuggestions
} = require('../controllers/userController');
const { auth } = require('../middlewares/auth');

// Validaciones
const searchValidation = [
  body('q')
    .isLength({ min: 2 })
    .withMessage('El término de búsqueda debe tener al menos 2 caracteres')
];

// Rutas públicas
router.get('/profile/:username', getUserProfile);
router.get('/:username/posts', getUserPosts);
router.get('/:username/stories', getUserStories);
router.get('/:username/followers', getFollowers);
router.get('/:username/following', getFollowing);
router.get('/search', searchValidation, searchUsers);

// Ruta temporal para eliminar todos los usuarios (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  router.delete('/all', async (req, res) => {
    try {
      const User = require('../models/User');
      await User.deleteMany({});
      res.json({
        success: true,
        message: 'Todos los usuarios eliminados',
        count: 0
      });
    } catch (error) {
      console.error('Error eliminando usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando usuarios'
      });
    }
  });
}

// Rutas protegidas
router.post('/:username/follow', auth, followUser);
router.delete('/:username/follow', auth, unfollowUser);
router.post('/:username/block', auth, blockUser);
router.delete('/:username/block', auth, unblockUser);
router.get('/blocked/list', auth, getBlockedUsers);
router.get('/suggestions', auth, getUserSuggestions);

module.exports = router;
