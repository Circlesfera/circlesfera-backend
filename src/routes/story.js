import express from 'express'
const router = express.Router()
import {
  createStory,
  getStoriesForFeed,
  getStory,
  addReaction,
  removeReaction,
  addReply,
  deleteStory,
  cleanupExpiredStories,
  getUsersWithStories
} from '../controllers/storyController.js'
import { auth } from '../middlewares/auth.js'
import { uploadFields, handleUploadError } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { createStorySchema } from '../schemas/storySchema.js'
import imageOptimizer from '../middlewares/imageOptimizer.js'
import { checkStoryOwnership } from '../middlewares/checkOwnership.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'

// Rutas públicas
router.get('/feed', getStoriesForFeed)
router.get('/users', auth, getUsersWithStories)
// Rutas específicas antes de las genéricas
router.get('/:id', getStory)

// Rutas protegidas
router.post(
  '/',
  auth,
  rateLimitByUser('createStory'),
  uploadFields,
  imageOptimizer,
  validate(createStorySchema),
  createStory,
  handleUploadError
)

router.post('/:id/reaction', auth, rateLimitByUser('like'), addReaction)

router.delete('/:id/reaction', auth, removeReaction)
router.post('/:id/reply', auth, rateLimitByUser('createComment'), addReply)
router.delete('/:id', auth, checkStoryOwnership(), deleteStory)

// Rutas administrativas
router.post('/cleanup/expired', auth, cleanupExpiredStories)

export default router
