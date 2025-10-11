import express from 'express'
const router = express.Router()
import { body } from 'express-validator'
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
import imageOptimizer from '../middlewares/imageOptimizer.js'

// Validaciones
const createPostValidation = [
  body('type')
    .isIn(['image', 'video'])
    .withMessage('El tipo debe ser image o video'),
  body('caption')
    .optional()
    .isLength({ max: 2200 })
    .withMessage('La descripción no puede exceder 2200 caracteres'),
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder 100 caracteres'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Los tags deben ser una cadena separada por comas'),
  body('text')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('El texto no puede exceder 5000 caracteres')
]

const updatePostValidation = [
  body('caption')
    .optional()
    .isLength({ max: 2200 })
    .withMessage('La descripción no puede exceder 2200 caracteres'),
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder 100 caracteres'),
  body('tags')
    .optional()
    .isString()
    .withMessage('Los tags deben ser una cadena separada por comas')
]

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
  createPostValidation,
  createPost,
  handleUploadError
)

// Ruta para posts de texto (sin archivos)
router.post('/', auth, createPostValidation, createPost)

router.put('/:id', auth, updatePostValidation, updatePost)

router.post('/:id/like', auth, toggleLike)
router.delete('/:id', auth, deletePost)

export default router
