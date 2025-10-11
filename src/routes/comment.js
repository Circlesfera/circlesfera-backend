import express from 'express'
const router = express.Router()
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
import { validate } from '../middlewares/validate.js'
import { createCommentSchema, updateCommentSchema } from '../schemas/commentSchema.js'

// Rutas públicas con autenticación opcional
router.get('/user/:username', optionalAuth, getUserComments)
router.get('/post/:postId', optionalAuth, getComments)
router.get('/:commentId/replies', optionalAuth, getReplies)

// Rutas protegidas
router.post('/post/:postId', auth, validate(createCommentSchema), createComment)

router.put('/:commentId', auth, validate(updateCommentSchema), updateComment)

router.post('/:commentId/like', auth, toggleLike)
router.delete('/:commentId', auth, deleteComment)

export default router
