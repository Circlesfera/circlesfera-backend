const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  createPost, 
  getFeed, 
  getPost, 
  toggleLike, 
  getLikes, 
  getUserPosts,
  getTrendingPosts,
  deletePost,
  updatePost
} = require('../controllers/postController');
const { auth } = require('../middlewares/auth');
const { uploadFields, handleUploadError } = require('../middlewares/upload');

// Validaciones
const createPostValidation = [
  body('type')
    .isIn(['image', 'video', 'text'])
    .withMessage('El tipo debe ser image, video o text'),
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
];

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
];

// Rutas públicas
router.get('/trending', getTrendingPosts);
router.get('/user/:username', getUserPosts);

// Rutas protegidas
router.get('/feed', auth, getFeed);

// Rutas con parámetros (deben ir después de las rutas específicas)
router.get('/:id', getPost);
router.get('/:id/likes', getLikes);

router.post('/', 
  auth, 
  uploadFields,
  createPostValidation,
  createPost,
  handleUploadError
);

router.put('/:id',
  auth,
  updatePostValidation,
  updatePost
);

router.post('/:id/like', auth, toggleLike);
router.delete('/:id', auth, deletePost);

module.exports = router;
