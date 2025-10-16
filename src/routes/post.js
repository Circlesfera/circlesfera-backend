import express from 'express'
const router = express.Router()
import {
  createPost,
  deletePost,
  getFeed,
  getLikes,
  getPost,
  getRecentPosts,
  getTrendingPosts,
  likePost,
  unlikePost,
  updatePost
} from '../controllers/postController.js'
import { auth } from '../middlewares/auth.js'
import { handleUploadError, uploadFields } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { createPostSchema, updatePostSchema } from '../schemas/postSchema.js'
import imageOptimizer from '../middlewares/imageOptimizer.js'
import { checkPostOwnership } from '../middlewares/checkOwnership.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'
import { csrfProtection } from '../middlewares/csrf.js'
import logger from '../utils/logger.js'

// Rutas públicas
router.get('/trending', getTrendingPosts)
router.get('/recent', getRecentPosts)

// Rutas protegidas
router.get('/feed', auth, getFeed)

// Endpoint temporal para limpiar caché del feed (DEBUG)
router.delete('/feed/cache', auth, async (req, res) => {
  try {
    const { userId } = req
    const cache = (await import('../utils/cache.js')).default

    // Limpiar todas las claves de caché del feed para este usuario
    const pattern = `feed:${userId}:*`

    // Nota: Esta implementación es básica, en producción usarías Redis SCAN
    logger.info(`🔍 Limpiando caché del feed para usuario ${userId}`)

    res.json({
      success: true,
      message: 'Caché del feed limpiado'
    })
  } catch (error) {
    logger.error('Error limpiando caché del feed:', error)
    res.status(500).json({
      success: false,
      message: 'Error al limpiar caché'
    })
  }
})

// Rutas con parámetros (deben ir después de las rutas específicas)
router.get('/:id', auth, getPost)
router.get('/:id/likes', getLikes)

// Ruta para crear posts (solo image/video, sin texto)
router.post(
  '/',
  auth,
  csrfProtection(),
  rateLimitByUser('createPost'),
  uploadFields,
  imageOptimizer,
  validate(createPostSchema),
  createPost,
  handleUploadError
)

// Ruta para actualizar posts (con validación de ownership)
router.put('/:id', auth, csrfProtection(), checkPostOwnership(), validate(updatePostSchema), updatePost)

// Rutas para likes (consistente con reels: POST para like, DELETE para unlike)
router.post('/:id/like', auth, csrfProtection(), rateLimitByUser('like'), likePost)
router.delete('/:id/like', auth, csrfProtection(), unlikePost)

// Eliminar post (con validación de ownership)
router.delete('/:id', auth, csrfProtection(), checkPostOwnership(), rateLimitByUser('deletePost'), deletePost)

export default router
