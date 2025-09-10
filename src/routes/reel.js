const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { uploadFields } = require('../middlewares/upload');
const reelController = require('../controllers/reelController');

// Ruta de prueba simple
router.get('/test', (req, res) => {
  res.json({ message: 'Reel routes funcionando' });
});

// Rutas públicas (sin autenticación)
router.get('/feed', reelController.getReelsForFeed);
router.get('/trending', reelController.getTrendingReels);
router.get('/search/hashtag/:hashtag', reelController.searchReelsByHashtag);
router.get('/user/:username', reelController.getUserReels);
router.get('/:id', reelController.getReel);

// Rutas protegidas (requieren autenticación)
router.post('/', auth, uploadFields, reelController.createReel);

router.post('/:id/like', auth, reelController.likeReel);
router.delete('/:id/like', auth, reelController.unlikeReel);
router.post('/:id/comment', auth, reelController.commentReel);
router.delete('/:id', auth, reelController.deleteReel);

module.exports = router;
