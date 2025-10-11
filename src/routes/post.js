import express from 'express'
const router = express.Router()
import {
  createPost,
  getFeed,
  getPost,
  toggleLike,
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

// Rutas públicas
router.get('/trending', getTrendingPosts)
router.get('/recent', getRecentPosts)

// Rutas protegidas
router.get('/feed', auth, getFeed)

// Rutas con parámetros (deben ir después de las rutas específicas)
router.get('/:id', getPost)
router.get('/:id/likes', getLikes)

// Ruta para posts con archivos (imagen/video)
router.post(
  '/media',
  auth,
  uploadFields,
  imageOptimizer,
  validate(createPostSchema),
  createPost,
  handleUploadError
)

// Ruta para posts (solo image/video, sin texto)
router.post('/', auth, validate(createPostSchema), createPost)

router.put('/:id', auth, validate(updatePostSchema), updatePost)

router.post('/:id/like', auth, toggleLike)
router.delete('/:id', auth, deletePost)

export default router
