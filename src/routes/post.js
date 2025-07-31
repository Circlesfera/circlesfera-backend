const express = require('express');
const router = express.Router();
const { 
  createPost, 
  getPosts, 
  toggleLike, 
  getLikes, 
  getFeed, 
  getPost, 
  deletePost 
} = require('../controllers/postController');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Crear post (protegido) - soporta texto, imagen y video
router.post('/', auth, upload.single('file'), createPost);

// Listar posts (público) - soporta filtros por tipo
router.get('/', getPosts);

// Feed de usuarios seguidos y propio usuario (protegido) - DEBE IR ANTES DE /:id
router.get('/feed', auth, getFeed);

// Obtener un post específico (público)
router.get('/:id', getPost);

// Like/unlike post (protegido)
router.post('/:id/like', auth, toggleLike);

// Listar usuarios que han dado like
router.get('/:id/likes', getLikes);

// Eliminar post (protegido)
router.delete('/:id', auth, deletePost);

module.exports = router;
