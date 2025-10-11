import express from 'express'
const router = express.Router()
import { auth } from '../middlewares/auth.js'
import { uploadFields } from '../middlewares/upload.js'
import reelController from '../controllers/reelController.js'


// Rutas públicas (sin autenticación)
router.get('/feed', reelController.getReelsForFeed)
router.get('/trending', reelController.getTrendingReels)
router.get('/search/hashtag/:hashtag', reelController.searchReelsByHashtag)
// Rutas específicas antes de las genéricas
router.get('/:id', reelController.getReel)

// Rutas protegidas (requieren autenticación)
router.post('/', auth, uploadFields, reelController.createReel)

router.post('/:id/like', auth, reelController.likeReel)
router.delete('/:id/like', auth, reelController.unlikeReel)
router.post('/:id/comment', auth, reelController.commentReel)
router.delete('/:id', auth, reelController.deleteReel)

export default router
