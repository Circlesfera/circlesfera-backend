const express = require('express');
const router = express.Router();
const { createPost, getPosts } = require('../controllers/postController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Crear post (protegido)
router.post('/', auth, upload.single('image'), createPost);
// Listar posts (público)
router.get('/', getPosts);
// Like/unlike post (protegido)
router.post('/:id/like', auth, require('../controllers/postController').toggleLike);
// Listar usuarios que han dado like
router.get('/:id/likes', require('../controllers/postController').getLikes);

module.exports = router;
