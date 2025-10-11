import express from 'express'
const router = express.Router()
import { body, query } from 'express-validator'
import {
  deleteMessage,
  editMessage,
  forwardMessage,
  getMessages,
  getMessageStats,
  searchMessages,
  sendImageMessage,
  sendLocationMessage,
  sendTextMessage,
  sendVideoMessage
} from '../controllers/messageController.js'
import { auth } from '../middlewares/auth.js'
import { handleUploadError, uploadSingle } from '../middlewares/upload.js'
import { csrfProtection } from '../middlewares/csrf.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'
import { checkConversationParticipant, checkMessageOwnership } from '../middlewares/checkOwnership.js'

// Validaciones
const sendTextMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El mensaje debe tener entre 1 y 1000 caracteres'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('ID de mensaje de respuesta inválido')
]

const editMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El mensaje debe tener entre 1 y 1000 caracteres')
]

const sendLocationMessageValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitud inválida'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitud inválida'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('El nombre de la ubicación no puede exceder 100 caracteres'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La dirección no puede exceder 200 caracteres')
]

const forwardMessageValidation = [
  body('conversationIds')
    .isArray({ min: 1 })
    .withMessage('Debe especificar al menos una conversación')
]

const searchMessagesValidation = [
  query('query')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 2 y 100 caracteres')
]

// Mensajes de conversacion
router.get('/conversation/:conversationId', auth, getMessages)
router.get('/conversation/:conversationId/stats', auth, getMessageStats)
router.get('/conversation/:conversationId/search', auth, searchMessagesValidation, searchMessages)

// Enviar mensajes (con CSRF y rate limiting)
router.post('/conversation/:conversationId/text', auth, csrfProtection(), checkConversationParticipant('conversationId'), rateLimitByUser('sendMessage'), sendTextMessageValidation, sendTextMessage)
router.post('/conversation/:conversationId/image', auth, csrfProtection(), checkConversationParticipant('conversationId'), rateLimitByUser('sendMessage'), uploadSingle, sendImageMessage, handleUploadError)
router.post('/conversation/:conversationId/video', auth, csrfProtection(), checkConversationParticipant('conversationId'), rateLimitByUser('sendMessage'), uploadSingle, sendVideoMessage, handleUploadError)
router.post('/conversation/:conversationId/location', auth, csrfProtection(), checkConversationParticipant('conversationId'), rateLimitByUser('sendMessage'), sendLocationMessageValidation, sendLocationMessage)

// Mensajes individuales (con ownership)
router.put('/message/:messageId', auth, csrfProtection(), checkMessageOwnership('messageId'), editMessageValidation, editMessage)
router.delete('/message/:messageId', auth, csrfProtection(), checkMessageOwnership('messageId'), deleteMessage)
router.post('/message/:messageId/forward', auth, csrfProtection(), rateLimitByUser('sendMessage'), forwardMessageValidation, forwardMessage)

export default router
