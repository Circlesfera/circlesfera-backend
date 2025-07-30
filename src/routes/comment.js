const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  addComment,
  getComments,
  deleteComment
} = require('../controllers/commentController');

// Añadir comentario a un post (protegido)
router.post('/:postId', auth, addComment);
// Listar comentarios de un post
router.get('/:postId', getComments);
// Eliminar comentario (protegido)
router.delete('/:id', auth, deleteComment);

module.exports = router;
