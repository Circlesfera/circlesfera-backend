const express = require('express');
const router = express.Router();
const { createPost, getPosts } = require('../controllers/postController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Crear post (protegido)
router.post('/', auth, upload.single('image'), createPost);
// Listar posts (público)
router.get('/', getPosts);

module.exports = router;
