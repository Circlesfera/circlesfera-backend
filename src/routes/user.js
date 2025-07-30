const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getProfile
} = require('../controllers/userController');

// Seguir usuario
router.post('/:id/follow', auth, followUser);
// Dejar de seguir usuario
router.post('/:id/unfollow', auth, unfollowUser);
// Ver seguidores
router.get('/:id/followers', getFollowers);
// Ver seguidos
router.get('/:id/following', getFollowing);
// Ver perfil
router.get('/:id', getProfile);

module.exports = router;
