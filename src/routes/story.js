const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  createStory,
  getStoriesForFeed,
  getUserStories,
  getStory,
  addReaction,
  removeReaction,
  addReply,
  deleteStory,
  cleanupExpiredStories
} = require('../controllers/storyController');
const { auth } = require('../middlewares/auth');
const { uploadFields, handleUploadError } = require('../middlewares/upload');

// Validaciones
const createStoryValidation = [
  body('type')
    .isIn(['image', 'video', 'text'])
    .withMessage('El tipo debe ser image, video o text'),
  body('caption')
    .optional()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder 100 caracteres'),
  body('textContent')
    .optional()
    .isLength({ max: 500 })
    .withMessage('El contenido de texto no puede exceder 500 caracteres')
];

const addReplyValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('La respuesta debe tener entre 1 y 200 caracteres')
];

const addReactionValidation = [
  body('reactionType')
    .isIn(['like', 'love', 'laugh', 'wow', 'sad', 'angry'])
    .withMessage('Tipo de reacción no válido')
];

// Rutas públicas
router.get('/feed', auth, getStoriesForFeed);
router.get('/user/:username', getUserStories);
router.get('/:id', auth, getStory);

// Rutas protegidas
router.post('/', 
  auth, 
  uploadFields,
  createStoryValidation,
  createStory,
  handleUploadError
);

router.post('/:id/reaction',
  auth,
  addReactionValidation,
  addReaction
);

router.delete('/:id/reaction', auth, removeReaction);
router.post('/:id/reply', auth, addReplyValidation, addReply);
router.delete('/:id', auth, deleteStory);

// Rutas administrativas
router.post('/cleanup/expired', auth, cleanupExpiredStories);

module.exports = router;
