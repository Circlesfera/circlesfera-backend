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
  getRecentPosts,
  deletePost,
  updatePost,
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
    .withMessage('El texto no puede exceder 5000 caracteres'),
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
    .withMessage('Los tags deben ser una cadena separada por comas'),
];

// Rutas públicas
router.get('/trending', getTrendingPosts);
router.get('/recent', getRecentPosts);
router.get('/user/:username', getUserPosts);

// Ruta de prueba
router.post('/test', auth, (req, res) => {
  res.json({
    success: true,
    message: 'Ruta de prueba funcionando',
    body: req.body,
  });
});

// Ruta de prueba para crear post
router.post('/test-create', auth, async (req, res) => {
  try {
    const Post = require('../models/Post');
    const post = new Post({
      user: req.userId,
      type: 'text',
      caption: 'Test post',
      content: {
        text: 'Este es un post de prueba',
      },
    });

    await post.save();
    await post.populate('user', 'username avatar fullName');

    res.json({
      success: true,
      message: 'Post de prueba creado',
      post,
    });
  } catch (error) {
    console.error('Error creating test post:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear post de prueba',
      error: error.message,
    });
  }
});

// Ruta para limpiar todos los posts
router.post('/clear-all-posts', async (req, res) => {
  try {
    const Post = require('../models/Post');
    const result = await Post.deleteMany({});

    res.json({
      success: true,
      message: 'Todos los posts eliminados',
      count: result.deletedCount,
    });
  } catch (error) {
    console.error('Error clearing posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar posts',
      error: error.message,
    });
  }
});

// Rutas protegidas
router.get('/feed', auth, getFeed);

// Rutas con parámetros (deben ir después de las rutas específicas)
router.get('/:id', getPost);
router.get('/:id/likes', getLikes);

// Ruta para posts con archivos (imagen/video)
router.post('/media',
  auth,
  uploadFields,
  createPostValidation,
  createPost,
  handleUploadError,
);

// Ruta para posts de texto (sin archivos)
router.post('/',
  auth,
  createPostValidation,
  createPost,
);

router.put('/:id',
  auth,
  updatePostValidation,
  updatePost,
);

router.post('/:id/like', auth, toggleLike);
router.delete('/:id', auth, deletePost);

module.exports = router;
