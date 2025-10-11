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
import { checkCommentOwnership } from '../middlewares/checkOwnership.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'

// Rutas públicas con autenticación opcional
router.get('/user/:username', optionalAuth, getUserComments)
router.get('/post/:postId', optionalAuth, getComments)
router.get('/:commentId/replies', optionalAuth, getReplies)

// Rutas protegidas
router.post('/post/:postId', auth, rateLimitByUser('createComment'), validate(createCommentSchema), createComment)

router.put('/:commentId', auth, checkCommentOwnership('commentId'), validate(updateCommentSchema), updateComment)

router.post('/:commentId/like', auth, rateLimitByUser('like'), toggleLike)
router.delete('/:commentId', auth, checkCommentOwnership('commentId'), deleteComment)

export default router
