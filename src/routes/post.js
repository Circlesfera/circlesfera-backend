import express from 'express'
const router = express.Router()
import {
  createPost,
  getFeed,
  getPost,
  likePost,
  unlikePost,
  getLikes,
  getTrendingPosts,
  getRecentPosts,
  deletePost,
  updatePost
} from '../controllers/postController.js'
import { auth } from '../middlewares/auth.js'
import { uploadFields, handleUploadError } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { createPostSchema, updatePostSchema } from '../schemas/postSchema.js'
import imageOptimizer from '../middlewares/imageOptimizer.js'
import { checkPostOwnership } from '../middlewares/checkOwnership.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'
import { csrfProtection } from '../middlewares/csrf.js'

// Rutas públicas
router.get('/trending', getTrendingPosts)
router.get('/recent', getRecentPosts)

// Rutas protegidas
router.get('/feed', auth, getFeed)

// Rutas con parámetros (deben ir después de las rutas específicas)
router.get('/:id', getPost)
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
