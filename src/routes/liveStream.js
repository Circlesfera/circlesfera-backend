import express from 'express'
const router = express.Router()
import { body, param, query, validationResult } from 'express-validator'
import { optionalAuth, auth as protect } from '../middlewares/auth.js'
import {
  addViewer,
  createLiveStream,
  endLiveStream,
  getLiveStream,
  getLiveStreams,
  inviteCoHost,
  likeLiveStream,
  removeViewer,
  startLiveStream,
  unlikeLiveStream
} from '../controllers/liveStreamController.js'

// Validaciones
const createLiveStreamValidation = [
  body('title')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El título debe tener entre 1 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('La fecha programada debe ser válida'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic debe ser un valor booleano'),
  body('allowComments')
    .optional()
    .isBoolean()
    .withMessage('allowComments debe ser un valor booleano'),
  body('allowShares')
    .optional()
    .isBoolean()
    .withMessage('allowShares debe ser un valor booleano'),
  body('notifyFollowers')
    .optional()
    .isBoolean()
    .withMessage('notifyFollowers debe ser un valor booleano'),
  body('notifyCloseFriends')
    .optional()
    .isBoolean()
    .withMessage('notifyCloseFriends debe ser un valor booleano'),
  body('saveToCSTV')
    .optional()
    .isBoolean()
    .withMessage('saveToCSTV debe ser un valor booleano')
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

const startLiveStreamValidation = [
  body('streamKey').notEmpty().withMessage('El stream key es requerido'),
  body('rtmpUrl').optional().isURL().withMessage('La URL RTMP debe ser válida'),
  body('playbackUrl')
    .optional()
    .isURL()
    .withMessage('La URL de playback debe ser válida'),
  body('thumbnailUrl')
    .optional()
    .isURL()
    .withMessage('La URL de thumbnail debe ser válida')
]

const endLiveStreamValidation = [
  body('saveToCSTV')
    .optional()
    .isBoolean()
    .withMessage('saveToCSTV debe ser un valor booleano'),
  body('cstvTitle')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El título de CSTV debe tener entre 1 y 100 caracteres'),
  body('cstvDescription')
    .optional()
    .isLength({ max: 2200 })
    .withMessage('La descripción de CSTV no puede exceder 2200 caracteres'),
  body('cstvCategory')
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
    .withMessage('Categoría de CSTV no válida')
]

const inviteCoHostValidation = [
  body('userId').isMongoId().withMessage('El ID del usuario debe ser válido')
]

const streamIdValidation = [
  param('streamId')
    .isMongoId()
    .withMessage('El ID de la transmisión debe ser válido')
]

const queryValidation = [
  query('status')
    .optional()
    .isIn(['live', 'scheduled', 'ended', 'cancelled'])
    .withMessage('Estado de transmisión no válido'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100')
]

// Rutas de Live Streaming

// @route   POST /api/live-streams
// @desc    Crear una nueva transmisión en vivo
// @access  Private
router.post(
  '/',
  protect,
  ...createLiveStreamValidation,
  handleValidationErrors,
  createLiveStream
)

// @route   GET /api/live-streams
// @desc    Obtener transmisiones en vivo
// @access  Public
router.get(
  '/',
  optionalAuth,
  queryValidation,
  handleValidationErrors,
  getLiveStreams
)

// @route   GET /api/live-streams/:streamId
// @desc    Obtener una transmisión específica
// @access  Public
router.get(
  '/:streamId',
  optionalAuth,
  streamIdValidation,
  handleValidationErrors,
  getLiveStream
)

// @route   PUT /api/live-streams/:streamId/start
// @desc    Iniciar una transmisión en vivo
// @access  Private (solo propietario)
router.put(
  '/:streamId/start',
  protect,
  ...streamIdValidation,
  ...startLiveStreamValidation,
  handleValidationErrors,
  startLiveStream
)

// @route   PUT /api/live-streams/:streamId/end
// @desc    Terminar una transmisión en vivo
// @access  Private (solo propietario)
router.put(
  '/:streamId/end',
  protect,
  ...streamIdValidation,
  ...endLiveStreamValidation,
  handleValidationErrors,
  endLiveStream
)

// @route   POST /api/live-streams/:streamId/viewer
// @desc    Agregar viewer a la transmisión
// @access  Public
router.post(
  '/:streamId/viewer',
  optionalAuth,
  streamIdValidation,
  handleValidationErrors,
  addViewer
)

// @route   DELETE /api/live-streams/:streamId/viewer
// @desc    Remover viewer de la transmisión
// @access  Public
router.delete(
  '/:streamId/viewer',
  optionalAuth,
  streamIdValidation,
  handleValidationErrors,
  removeViewer
)

// @route   POST /api/live-streams/:streamId/invite-cohost
// @desc    Invitar co-host a la transmisión
// @access  Private (solo propietario)
router.post(
  '/:streamId/invite-cohost',
  protect,
  ...streamIdValidation,
  ...inviteCoHostValidation,
  handleValidationErrors,
  inviteCoHost
)

// @route   POST /api/live-streams/:streamId/like
// @desc    Dar like a una transmisión
// @access  Private
router.post(
  '/:streamId/like',
  protect,
  streamIdValidation,
  handleValidationErrors,
  likeLiveStream
)

// @route   DELETE /api/live-streams/:streamId/like
// @desc    Quitar like de una transmisión
// @access  Private
router.delete(
  '/:streamId/like',
  protect,
  streamIdValidation,
  handleValidationErrors,
  unlikeLiveStream
)

export default router
