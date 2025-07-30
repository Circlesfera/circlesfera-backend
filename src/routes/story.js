const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const {
  createStory,
  getStories,
  deleteStory
} = require('../controllers/storyController');

// Crear story (protegido)
router.post('/', auth, upload.single('image'), createStory);
// Listar stories de seguidos y propio usuario (protegido)
router.get('/', auth, getStories);
// Eliminar story (protegido)
router.delete('/:id', auth, deleteStory);

module.exports = router;
