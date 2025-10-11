import express from 'express'
const router = express.Router()
import { auth } from '../middlewares/auth.js'
import { uploadFields } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { createReelSchema, reelCommentSchema } from '../schemas/reelSchema.js'
import reelController from '../controllers/reelController.js'

// updateReelSchema disponible para futuras implementaciones

// Rutas públicas (sin autenticación)
router.get('/feed', reelController.getReelsForFeed)
router.get('/trending', reelController.getTrendingReels)
router.get('/search/hashtag/:hashtag', reelController.searchReelsByHashtag)
// Rutas específicas antes de las genéricas
router.get('/:id', reelController.getReel)

// Rutas protegidas (requieren autenticación)
router.post('/', auth, uploadFields, validate(createReelSchema), reelController.createReel)

router.post('/:id/like', auth, reelController.likeReel)
router.delete('/:id/like', auth, reelController.unlikeReel)
router.post('/:id/comment', auth, validate(reelCommentSchema), reelController.commentReel)
router.delete('/:id', auth, reelController.deleteReel)

export default router
