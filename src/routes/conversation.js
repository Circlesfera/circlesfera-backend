import express from 'express'
const router = express.Router()
import { body } from 'express-validator'
import {
  getConversations,
  getConversation,
  createDirectConversation,
  createGroupConversation,
  addParticipant,
  removeParticipant,
  addAdmin,
  removeAdmin,
  updateConversation,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
  getConversationStats
} from '../controllers/conversationController.js'
import { auth } from '../middlewares/auth.js'

// Validaciones
const createGroupValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre del grupo debe tener entre 1 y 50 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('participantIds')
    .isArray({ min: 1 })
    .withMessage('Debe incluir al menos un participante')
]

const updateConversationValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre del grupo debe tener entre 1 y 50 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres')
]

const participantValidation = [
  body('participantId')
    .isMongoId()
    .withMessage('ID de participante inválido')
]

const adminValidation = [
  body('adminId')
    .isMongoId()
    .withMessage('ID de administrador inválido')
]

// Rutas protegidas
router.get('/', auth, getConversations)
router.get('/stats', auth, getConversationStats)

router.post('/direct', auth, participantValidation, createDirectConversation)
router.post('/group', auth, createGroupValidation, createGroupConversation)

router.get('/:conversationId', auth, getConversation)
router.put('/:conversationId', auth, updateConversationValidation, updateConversation)

router.post('/:conversationId/participants', auth, participantValidation, addParticipant)
router.delete('/:conversationId/participants', auth, participantValidation, removeParticipant)

router.post('/:conversationId/admins', auth, adminValidation, addAdmin)
router.delete('/:conversationId/admins', auth, adminValidation, removeAdmin)

router.post('/:conversationId/archive', auth, archiveConversation)
router.post('/:conversationId/unarchive', auth, unarchiveConversation)
router.delete('/:conversationId', auth, deleteConversation)

export default router
