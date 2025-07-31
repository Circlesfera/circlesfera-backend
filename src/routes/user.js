const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getProfile,
  getProfileByUsername
} = require('../controllers/userController');

// Seguir usuario
router.post('/:id/follow', auth, followUser);
// Dejar de seguir usuario
router.post('/:id/unfollow', auth, unfollowUser);
// Ver seguidores
router.get('/:id/followers', getFollowers);
// Ver seguidos
router.get('/:id/following', getFollowing);
// Sugerencias de usuarios a seguir (debe ir antes de /:id)
router.get('/suggestions', auth, require('../controllers/userController').getSuggestions);
// Ver perfil por username (debe ir antes de /:id)
router.get('/profile/:username', getProfileByUsername);
// Ver perfil por ID
router.get('/:id', getProfile);

module.exports = router;
