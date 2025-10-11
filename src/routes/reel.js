import express from 'express'
const router = express.Router()
import { auth } from '../middlewares/auth.js'
import { uploadFields } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { createReelSchema, reelCommentSchema } from '../schemas/reelSchema.js'
import reelController from '../controllers/reelController.js'
import { checkReelOwnership } from '../middlewares/checkOwnership.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'
import { csrfProtection } from '../middlewares/csrf.js'

// updateReelSchema disponible para futuras implementaciones

// Rutas públicas (sin autenticación)
router.get('/feed', reelController.getReelsForFeed)
router.get('/trending', reelController.getTrendingReels)
router.get('/search/hashtag/:hashtag', reelController.searchReelsByHashtag)
// Rutas específicas antes de las genéricas
router.get('/:id', reelController.getReel)

// Rutas protegidas (requieren autenticación + CSRF)
router.post('/', auth, csrfProtection(), rateLimitByUser('createReel'), uploadFields, validate(createReelSchema), reelController.createReel)

router.post('/:id/like', auth, csrfProtection(), rateLimitByUser('like'), reelController.likeReel)
router.delete('/:id/like', auth, csrfProtection(), reelController.unlikeReel)
router.post('/:id/save', auth, csrfProtection(), rateLimitByUser('save'), reelController.saveReel)
router.delete('/:id/save', auth, csrfProtection(), reelController.unsaveReel)
router.post('/:id/comment', auth, csrfProtection(), rateLimitByUser('createComment'), validate(reelCommentSchema), reelController.commentReel)
router.delete('/:id', auth, csrfProtection(), checkReelOwnership(), rateLimitByUser('deletePost'), reelController.deleteReel)

export default router
