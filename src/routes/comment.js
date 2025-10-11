import express from 'express'
const router = express.Router()
import { body } from 'express-validator'
import {
  createComment,
  getComments,
  getReplies,
  toggleLike,
  updateComment,
  deleteComment,
  getUserComments
} from '../controllers/commentController.js'
import { auth, optionalAuth } from '../middlewares/auth.js'

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
]

const updateCommentValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El comentario debe tener entre 1 y 1000 caracteres')
]

// Rutas públicas con autenticación opcional
router.get('/user/:username', optionalAuth, getUserComments)
router.get('/post/:postId', optionalAuth, getComments)
router.get('/:commentId/replies', optionalAuth, getReplies)

// Rutas protegidas
router.post('/post/:postId', auth, createCommentValidation, createComment)

router.put('/:commentId', auth, updateCommentValidation, updateComment)

router.post('/:commentId/like', auth, toggleLike)
router.delete('/:commentId', auth, deleteComment)

export default router
