const express = require('express')
const router = express.Router()
const { body, param, query, validationResult } = require('express-validator')
const { auth: protect, optionalAuth } = require('../middlewares/auth')
const {
  createCSTVVideo,
  getCSTVVideos,
  getCSTVVideo,
  updateCSTVVideo,
  deleteCSTVVideo,
  likeCSTVVideo,
  unlikeCSTVVideo,
  saveCSTVVideo,
  unsaveCSTVVideo,
  getTrendingVideos,
  searchVideos
} = require('../controllers/cstvController')

// Validaciones
const createCSTVValidation = [
  body('title')
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El título debe tener entre 1 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 2200 })
    .withMessage('La descripción no puede exceder 2200 caracteres'),
  body('video.url')
    .notEmpty()
    .withMessage('La URL del video es requerida')
    .isURL()
    .withMessage('La URL del video debe ser válida'),
  body('video.thumbnail')
    .notEmpty()
    .withMessage('La miniatura es requerida')
    .isURL()
    .withMessage('La URL de la miniatura debe ser válida'),
  body('video.duration')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('La duración debe ser un número positivo'),
  body('video.size')
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage('El tamaño del archivo debe ser un número positivo'),
  body('category')
    .optional()
    .isIn([
      'entertainment',
      'education',
      'gaming',
      'music',
      'sports',
      'lifestyle',
      'comedy',
      'news',
      'technology',
      'cooking',
      'travel',
      'fitness',
      'beauty',
      'art',
      'other'
    ])
    .withMessage('Categoría no válida'),
  body('visibility')
    .optional()
    .isIn(['public', 'followers', 'close_friends', 'private'])
    .withMessage('Visibilidad no válida'),
  body('ageRestriction')
    .optional()
    .isIn(['all', '13+', '16+', '18+'])
    .withMessage('Restricción de edad no válida'),
  body('allowComments')
    .optional()
    .isBoolean()
    .withMessage('allowComments debe ser un valor booleano'),
  body('allowLikes')
    .optional()
    .isBoolean()
    .withMessage('allowLikes debe ser un valor booleano'),
  body('allowShares')
    .optional()
    .isBoolean()
    .withMessage('allowShares debe ser un valor booleano'),
  body('tags').optional().isArray().withMessage('Los tags deben ser un array'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Cada tag no puede exceder 50 caracteres')
]

const updateCSTVValidation = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El título debe tener entre 1 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 2200 })
    .withMessage('La descripción no puede exceder 2200 caracteres'),
  body('category')
    .optional()
    .isIn([
      'entertainment',
      'education',
      'gaming',
      'music',
      'sports',
      'lifestyle',
      'comedy',
      'news',
      'technology',
      'cooking',
      'travel',
      'fitness',
      'beauty',
      'art',
      'other'
    ])
    .withMessage('Categoría no válida'),
  body('visibility')
    .optional()
    .isIn(['public', 'followers', 'close_friends', 'private'])
    .withMessage('Visibilidad no válida'),
  body('allowComments')
    .optional()
    .isBoolean()
    .withMessage('allowComments debe ser un valor booleano'),
  body('allowLikes')
    .optional()
    .isBoolean()
    .withMessage('allowLikes debe ser un valor booleano'),
  body('allowShares')
    .optional()
    .isBoolean()
    .withMessage('allowShares debe ser un valor booleano'),
  body('tags').optional().isArray().withMessage('Los tags deben ser un array'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Cada tag no puede exceder 50 caracteres')
]

const videoIdValidation = [
  param('videoId').isMongoId().withMessage('El ID del video debe ser válido')
]

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('El límite debe estar entre 1 y 50'),
  query('category')
    .optional()
    .isIn([
      'entertainment',
      'education',
      'gaming',
      'music',
      'sports',
      'lifestyle',
      'comedy',
      'news',
      'technology',
      'cooking',
      'travel',
      'fitness',
      'beauty',
      'art',
      'other'
    ])
    .withMessage('Categoría no válida'),
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('El ID del usuario debe ser válido'),
  query('sortBy')
    .optional()
    .isIn(['newest', 'oldest', 'views', 'likes', 'trending'])
    .withMessage('Orden de clasificación no válido')
]

const searchValidation = [
  query('q')
    .notEmpty()
    .withMessage('El término de búsqueda es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 1 y 100 caracteres'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('El límite debe estar entre 1 y 50')
]

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    })
  }
  next()
}

// Rutas de CSTV

// @route   POST /api/cstv
// @desc    Crear un nuevo video CSTV
// @access  Private
router.post(
  '/',
  protect,
  ...createCSTVValidation,
  handleValidationErrors,
  createCSTVVideo
)

// @route   GET /api/cstv
// @desc    Obtener videos CSTV
// @access  Public
router.get(
  '/',
  optionalAuth,
  queryValidation,
  handleValidationErrors,
  getCSTVVideos
)

// @route   GET /api/cstv/trending
// @desc    Obtener videos trending
// @access  Public
router.get(
  '/trending',
  optionalAuth,
  queryValidation,
  handleValidationErrors,
  getTrendingVideos
)

// @route   GET /api/cstv/search
// @desc    Buscar videos
// @access  Public
router.get(
  '/search',
  optionalAuth,
  searchValidation,
  handleValidationErrors,
  searchVideos
)

// @route   GET /api/cstv/:videoId
// @desc    Obtener un video específico
// @access  Public
router.get(
  '/:videoId',
  optionalAuth,
  videoIdValidation,
  handleValidationErrors,
  getCSTVVideo
)

// @route   PUT /api/cstv/:videoId
// @desc    Actualizar un video CSTV
// @access  Private (solo propietario)
router.put(
  '/:videoId',
  protect,
  ...videoIdValidation,
  ...updateCSTVValidation,
  handleValidationErrors,
  updateCSTVVideo
)

// @route   DELETE /api/cstv/:videoId
// @desc    Eliminar un video CSTV
// @access  Private (solo propietario)
router.delete(
  '/:videoId',
  protect,
  videoIdValidation,
  handleValidationErrors,
  deleteCSTVVideo
)

// @route   POST /api/cstv/:videoId/like
// @desc    Dar like a un video CSTV
// @access  Private
router.post(
  '/:videoId/like',
  protect,
  videoIdValidation,
  handleValidationErrors,
  likeCSTVVideo
)

// @route   DELETE /api/cstv/:videoId/like
// @desc    Quitar like de un video CSTV
// @access  Private
router.delete(
  '/:videoId/like',
  protect,
  videoIdValidation,
  handleValidationErrors,
  unlikeCSTVVideo
)

// @route   POST /api/cstv/:videoId/save
// @desc    Guardar un video CSTV
// @access  Private
router.post(
  '/:videoId/save',
  protect,
  videoIdValidation,
  handleValidationErrors,
  saveCSTVVideo
)

// @route   DELETE /api/cstv/:videoId/save
// @desc    Quitar de guardados un video CSTV
// @access  Private
router.delete(
  '/:videoId/save',
  protect,
  videoIdValidation,
  handleValidationErrors,
  unsaveCSTVVideo
)

module.exports = router
