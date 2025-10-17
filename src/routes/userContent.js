import express from 'express'
const router = express.Router()
import { auth } from '../middlewares/auth.js'
import { uploadFields } from '../middlewares/upload.js'

// Importar controladores refactorizados
import { reelController } from '../controllers/refactoredReelController.js'
import { postController } from '../controllers/refactoredPostController.js'
import { storyController } from '../controllers/refactoredStoryController.js'
import cstvController from '../controllers/cstvController.js'
import { liveStreamController } from '../controllers/refactoredLiveStreamController.js'

// Middleware para validar que el usuario existe (se puede agregar después)
// import { validateUser } from '../middlewares/validateUser.js'

// ===== REELS =====
// @route   GET /api/:username/reels
// @desc    Obtener reels de un usuario específico
// @access  Public
router.get('/:username/reels', reelController.getUserReels)

// @route   POST /api/:username/reels
// @desc    Crear un nuevo reel para el usuario autenticado
// @access  Private
router.post('/:username/reels', auth, uploadFields, reelController.createReel)

// ===== POSTS =====
// @route   GET /api/:username/posts
// @desc    Obtener posts de un usuario específico
// @access  Public
router.get('/:username/posts', postController.getUserPosts)

// @route   POST /api/:username/posts
// @desc    Crear un nuevo post para el usuario autenticado
// @access  Private
router.post('/:username/posts', auth, uploadFields, postController.createPost)

// ===== STORIES =====
// @route   GET /api/:username/stories
// @desc    Obtener stories de un usuario específico
// @access  Public
router.get('/:username/stories', storyController.getUserStories)

// @route   POST /api/:username/stories
// @desc    Crear una nueva story para el usuario autenticado
// @access  Private
router.post('/:username/stories', auth, uploadFields, storyController.createStory)

// ===== CSTV =====
// @route   GET /api/:username/cstv
// @desc    Obtener videos CSTV de un usuario específico
// @access  Public
router.get('/:username/cstv', cstvController.getUserCSTVVideos)

// @route   POST /api/:username/cstv
// @desc    Crear un nuevo video CSTV para el usuario autenticado
// @access  Private
router.post('/:username/cstv', auth, cstvController.createCSTVVideo)

// ===== LIVE STREAMS =====
// @route   GET /api/:username/live
// @desc    Obtener transmisiones en vivo de un usuario específico
// @access  Public
router.get('/:username/live', liveStreamController.getUserLiveStreams)

// @route   POST /api/:username/live
// @desc    Crear una nueva transmisión en vivo para el usuario autenticado
// @access  Private
router.post('/:username/live', auth, liveStreamController.createLiveStream)

export default router
