const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { protect, optionalAuth } = require('../middlewares/auth');
const {
  createComment,
  getComments,
  reactToComment,
  removeReaction,
  moderateComment,
  getCommentStats,
} = require('../controllers/liveCommentController');

// Validaciones
const createCommentValidation = [
  body('content')
    .notEmpty()
    .withMessage('El contenido del comentario es requerido')
    .isLength({ min: 1, max: 500 })
    .withMessage('El comentario debe tener entre 1 y 500 caracteres'),
  body('type')
    .optional()
    .isIn(['comment', 'question', 'reaction', 'system'])
    .withMessage('Tipo de comentario no válido'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('El ID del comentario de respuesta debe ser válido'),
  body('timestamp')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El timestamp debe ser un número positivo'),
  body('clientId')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El client ID no puede exceder 100 caracteres'),
];

const reactToCommentValidation = [
  body('reactionType')
    .optional()
    .isIn(['like', 'love', 'laugh', 'wow', 'angry'])
    .withMessage('Tipo de reacción no válido'),
];

const moderateCommentValidation = [
  body('action')
    .isIn(['hide', 'delete', 'pin', 'unpin'])
    .withMessage('Acción de moderación no válida'),
  body('reason')
    .optional()
    .isIn(['spam', 'inappropriate', 'harassment', 'hate_speech', 'other'])
    .withMessage('Razón de moderación no válida'),
];

const streamIdValidation = [
  param('streamId')
    .isMongoId()
    .withMessage('El ID de la transmisión debe ser válido'),
];

const commentIdValidation = [
  param('commentId')
    .isMongoId()
    .withMessage('El ID del comentario debe ser válido'),
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100'),
  query('since')
    .optional()
    .isISO8601()
    .withMessage('La fecha since debe ser válida'),
  query('type')
    .optional()
    .isIn(['comment', 'question', 'reaction', 'system'])
    .withMessage('Tipo de comentario no válido'),
  query('sortByPinned')
    .optional()
    .isBoolean()
    .withMessage('sortByPinned debe ser un valor booleano'),
];

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array(),
    });
  }
  next();
};

// Rutas de Live Comments

// @route   POST /api/live-streams/:streamId/comments
// @desc    Crear un comentario en transmisión en vivo
// @access  Private
router.post(
  '/:streamId/comments',
  protect,
  streamIdValidation,
  createCommentValidation,
  handleValidationErrors,
  createComment
);

// @route   GET /api/live-streams/:streamId/comments
// @desc    Obtener comentarios de una transmisión
// @access  Public
router.get(
  '/:streamId/comments',
  optionalAuth,
  streamIdValidation,
  queryValidation,
  handleValidationErrors,
  getComments
);

// @route   POST /api/live-streams/:streamId/comments/:commentId/react
// @desc    Reaccionar a un comentario
// @access  Private
router.post(
  '/:streamId/comments/:commentId/react',
  protect,
  streamIdValidation,
  commentIdValidation,
  reactToCommentValidation,
  handleValidationErrors,
  reactToComment
);

// @route   DELETE /api/live-streams/:streamId/comments/:commentId/react
// @desc    Remover reacción de un comentario
// @access  Private
router.delete(
  '/:streamId/comments/:commentId/react',
  protect,
  streamIdValidation,
  commentIdValidation,
  handleValidationErrors,
  removeReaction
);

// @route   PUT /api/live-streams/:streamId/comments/:commentId/moderate
// @desc    Moderar un comentario (solo streamer y co-hosts)
// @access  Private
router.put(
  '/:streamId/comments/:commentId/moderate',
  protect,
  streamIdValidation,
  commentIdValidation,
  moderateCommentValidation,
  handleValidationErrors,
  moderateComment
);

// @route   GET /api/live-streams/:streamId/comments/stats
// @desc    Obtener estadísticas de comentarios
// @access  Public
router.get(
  '/:streamId/comments/stats',
  optionalAuth,
  streamIdValidation,
  handleValidationErrors,
  getCommentStats
);

module.exports = router;
