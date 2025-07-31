const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  createComment, 
  getComments, 
  getReplies,
  toggleLike,
  updateComment,
  deleteComment,
  getUserComments
} = require('../controllers/commentController');
const { auth } = require('../middlewares/auth');

// Validaciones
const createCommentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El comentario debe tener entre 1 y 1000 caracteres'),
  body('parentComment')
    .optional()
    .isMongoId()
    .withMessage('ID de comentario padre inválido')
];

const updateCommentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El comentario debe tener entre 1 y 1000 caracteres')
];

// Rutas públicas
router.get('/user/:username', getUserComments);
router.get('/post/:postId', getComments);
router.get('/:commentId/replies', getReplies);

// Rutas protegidas
router.post('/post/:postId', 
  auth, 
  createCommentValidation,
  createComment
);

router.put('/:commentId',
  auth,
  updateCommentValidation,
  updateComment
);

router.post('/:commentId/like', auth, toggleLike);
router.delete('/:commentId', auth, deleteComment);

module.exports = router;
