const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { 
  getMessages,
  sendTextMessage,
  sendImageMessage,
  sendVideoMessage,
  sendLocationMessage,
  editMessage,
  deleteMessage,
  forwardMessage,
  searchMessages,
  getMessageStats
} = require('../controllers/messageController');
const { auth } = require('../middlewares/auth');
const { uploadSingle, uploadMultiple, handleUploadError } = require('../middlewares/upload');

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
];

const editMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El mensaje debe tener entre 1 y 1000 caracteres')
];

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
];

const forwardMessageValidation = [
  body('conversationIds')
    .isArray({ min: 1 })
    .withMessage('Debe especificar al menos una conversación')
];

const searchMessagesValidation = [
  query('query')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 2 y 100 caracteres')
];

// Rutas de conversaciones específicas
router.get('/conversation/:conversationId', auth, getMessages);
router.get('/conversation/:conversationId/stats', auth, getMessageStats);
router.get('/conversation/:conversationId/search', auth, searchMessagesValidation, searchMessages);

// Envío de mensajes
router.post('/conversation/:conversationId/text', auth, sendTextMessageValidation, sendTextMessage);
router.post('/conversation/:conversationId/image', auth, uploadSingle, sendImageMessage, handleUploadError);
router.post('/conversation/:conversationId/video', auth, uploadSingle, sendVideoMessage, handleUploadError);
router.post('/conversation/:conversationId/location', auth, sendLocationMessageValidation, sendLocationMessage);

// Gestión de mensajes individuales
router.put('/message/:messageId', auth, editMessageValidation, editMessage);
router.delete('/message/:messageId', auth, deleteMessage);
router.post('/message/:messageId/forward', auth, forwardMessageValidation, forwardMessage);

module.exports = router;
