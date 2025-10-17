/**
 * 🔒 VALIDATION MIDDLEWARE
 * =======================
 * Middleware centralizado para validación de entrada
 * Usa express-validator para validaciones robustas
 */

import { body, param, query, validationResult } from 'express-validator'
import logger from '../utils/logger.js'

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }))

    logger.warn('Errores de validación detectados:', {
      errors: errorMessages,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })

    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errorMessages
    })
  }

  next()
}

/**
 * Validaciones para parámetros de ruta
 */
export const validateObjectId = (paramName = 'id') =>
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} debe ser un ID válido de MongoDB`)

/**
 * Validaciones para paginación
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100')
]

/**
 * Validaciones para búsqueda
 */
export const validateSearch = [
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('El término de búsqueda debe tener entre 1 y 100 caracteres')
]

/**
 * Validaciones para posts
 */
export const validateCreatePost = [
  body('type')
    .isIn(['text', 'image', 'video', 'reel'])
    .withMessage('Tipo de publicación inválido'),
  body('caption')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2200 })
    .withMessage('El caption no puede exceder los 2200 caracteres'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder los 100 caracteres'),
  body('tags')
    .optional()
    .isString()
    .trim()
    .withMessage('Los tags deben ser una cadena de texto'),
  body('textContent')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('El contenido de texto no puede estar vacío para publicaciones de texto'),
  body('aspectRatio')
    .optional()
    .isString()
    .trim()
    .matches(/^\d+:\d+$/)
    .withMessage('El aspect ratio debe tener el formato "ancho:alto"'),
  body('originalAspectRatio')
    .optional()
    .isString()
    .trim()
    .matches(/^\d+:\d+$/)
    .withMessage('El aspect ratio original debe tener el formato "ancho:alto"')
]

export const validateUpdatePost = [
  body('caption')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2200 })
    .withMessage('El caption no puede exceder los 2200 caracteres'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder los 100 caracteres')
]

/**
 * Validaciones para usuarios
 */
export const validateCreateUser = [
  body('username')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El nombre de usuario debe tener entre 3 y 20 caracteres y solo contener letras, números y guiones bajos'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe proporcionar un email válido'),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales'),
  body('fullName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre completo debe tener entre 1 y 50 caracteres'),
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('La biografía no puede exceder los 150 caracteres')
]

export const validateUpdateUser = [
  body('fullName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre completo debe tener entre 1 y 50 caracteres'),
  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 150 })
    .withMessage('La biografía no puede exceder los 150 caracteres'),
  body('website')
    .optional()
    .isURL()
    .withMessage('El sitio web debe ser una URL válida'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder los 100 caracteres')
]

/**
 * Validaciones para autenticación
 */
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe proporcionar un email válido'),
  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('La contraseña es requerida')
]

export const validateRegister = [
  ...validateCreateUser,
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden')
      }
      return true
    })
]

/**
 * Validaciones para comentarios
 */
export const validateCreateComment = [
  body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('El comentario debe tener entre 1 y 500 caracteres'),
  body('postId')
    .isMongoId()
    .withMessage('ID de post inválido')
]

export const validateUpdateComment = [
  body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('El comentario debe tener entre 1 y 500 caracteres')
]

/**
 * Validaciones para mensajes
 */
export const validateCreateMessage = [
  body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('El mensaje debe tener entre 1 y 1000 caracteres'),
  body('conversationId')
    .isMongoId()
    .withMessage('ID de conversación inválido')
]


/**
 * Validaciones para administración
 */
export const validateUpdateUserRole = [
  body('role')
    .isIn(['user', 'moderator', 'admin'])
    .withMessage('Rol inválido. Debe ser: user, moderator o admin')
]

export const validateBanUser = [
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('La razón del ban debe tener entre 10 y 200 caracteres'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('La duración del ban debe ser entre 1 y 365 días')
]

export const validateSuspendUser = [
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('La razón de la suspensión debe tener entre 10 y 200 caracteres'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('La duración de la suspensión debe ser entre 1 y 30 días')
]

/**
 * Validaciones para consultas de administración
 */
export const validateAdminUsersQuery = [
  ...validatePagination,
  ...validateSearch,
  query('role')
    .optional()
    .isIn(['user', 'moderator', 'admin'])
    .withMessage('Rol inválido'),
  query('status')
    .optional()
    .isIn(['active', 'banned', 'suspended'])
    .withMessage('Estado inválido. Debe ser: active, banned o suspended'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'username', 'email', 'lastLoginAt', 'postsCount', 'reportsCount'])
    .withMessage('Campo de ordenamiento inválido'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Orden inválido. Debe ser: asc o desc')
]

/**
 * Validaciones para reportes
 */
export const validateReportQuery = [
  ...validatePagination,
  query('status')
    .optional()
    .isIn(['pending', 'reviewing', 'resolved', 'dismissed'])
    .withMessage('Estado de reporte inválido'),
  query('contentType')
    .optional()
    .isIn(['post', 'reel', 'story', 'comment', 'user', 'live_stream', 'message'])
    .withMessage('Tipo de contenido inválido'),
  query('reason')
    .optional()
    .isIn(['spam', 'harassment', 'inappropriate', 'violence', 'fake', 'other'])
    .withMessage('Razón de reporte inválida')
]

export const validateCreateReport = [
  body('contentType')
    .isIn(['post', 'reel', 'story', 'comment', 'user', 'live_stream', 'message'])
    .withMessage('Tipo de contenido inválido'),
  body('contentId')
    .isMongoId()
    .withMessage('ID de contenido inválido'),
  body('reason')
    .isIn(['spam', 'harassment', 'inappropriate', 'violence', 'fake', 'other'])
    .withMessage('Razón de reporte inválida'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('La descripción debe tener entre 10 y 500 caracteres')
]

export const validateUpdateReportStatus = [
  body('status')
    .isIn(['pending', 'reviewing', 'resolved', 'dismissed'])
    .withMessage('Estado de reporte inválido'),
  body('action')
    .optional()
    .isIn(['none', 'content_removed', 'user_banned', 'user_suspended', 'warning_sent'])
    .withMessage('Acción inválida'),
  body('moderatorNotes')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Las notas del moderador deben tener entre 10 y 500 caracteres')
]

/**
 * Validaciones para estadísticas de administración
 */
export const validateStatsQuery = [
  query('period')
    .optional()
    .isIn(['24h', '7d', '30d', '90d', '1y'])
    .withMessage('Período inválido. Debe ser: 24h, 7d, 30d, 90d o 1y'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'count', 'name'])
    .withMessage('Campo de ordenamiento inválido'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Orden inválido. Debe ser: asc o desc')
]

/**
 * Validaciones para analytics avanzados
 */
export const validateAnalyticsQuery = [
  query('timeRange')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Rango de tiempo inválido. Debe ser: 7d, 30d, 90d o 1y'),
  query('groupBy')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Agrupación inválida. Debe ser: daily, weekly o monthly'),
  query('contentType')
    .optional()
    .isIn(['post', 'reel', 'story'])
    .withMessage('Tipo de contenido inválido. Debe ser: post, reel o story'),
  query('sortBy')
    .optional()
    .isIn(['engagement', 'likes', 'comments', 'views', 'createdAt'])
    .withMessage('Campo de ordenamiento inválido'),
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  query('country')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('País debe tener entre 2 y 50 caracteres'),
  query('region')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Región debe tener entre 2 y 50 caracteres')
]

export const validatePeriodComparison = [
  body('metricType')
    .isIn(['users', 'content', 'engagement', 'reports', 'geographic', 'platform'])
    .withMessage('Tipo de métrica inválido'),
  body('currentPeriod')
    .isObject()
    .withMessage('Período actual debe ser un objeto'),
  body('previousPeriod')
    .isObject()
    .withMessage('Período anterior debe ser un objeto')
]

export const validateCustomMetrics = [
  body('metrics')
    .isArray({ min: 1, max: 10 })
    .withMessage('Debe proporcionar entre 1 y 10 métricas'),
  body('timeRange')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Rango de tiempo inválido'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filtros deben ser un objeto'),
  body('groupBy')
    .optional()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Agrupación inválida')
]

/**
 * Validaciones para archivos
 */
export const validateFileUpload = [
  body('type')
    .isIn(['image', 'video'])
    .withMessage('Tipo de archivo inválido')
]

/**
 * Sanitización de entrada
 */
export const sanitizeInput = (req, res, next) => {
  // Sanitizar strings en body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim()
      }
    }
  }

  // Sanitizar strings en query
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim()
      }
    }
  }

  next()
}

/**
 * Validación de rate limiting personalizada
 */
export const validateRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map()

  return (req, res, next) => {
    const key = req.ip
    const now = Date.now()
    const windowStart = now - windowMs

    // Limpiar requests antiguos
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart)
      requests.set(key, userRequests)
    } else {
      requests.set(key, [])
    }

    const userRequests = requests.get(key)

    if (userRequests.length >= maxRequests) {
      logger.warn('Rate limit excedido:', {
        ip: req.ip,
        requests: userRequests.length,
        endpoint: req.path
      })

      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Intenta más tarde.',
        retryAfter: Math.ceil(windowMs / 1000)
      })
    }

    userRequests.push(now)
    next()
  }
}

export default {
  handleValidationErrors,
  validateObjectId,
  validatePagination,
  validateSearch,
  validateCreatePost,
  validateUpdatePost,
  validateCreateUser,
  validateUpdateUser,
  validateLogin,
  validateRegister,
  validateCreateComment,
  validateUpdateComment,
  validateCreateMessage,
  validateCreateReport,
  validateUpdateUserRole,
  validateBanUser,
  validateSuspendUser,
  validateAdminUsersQuery,
  validateReportQuery,
  validateUpdateReportStatus,
  validateStatsQuery,
  validateAnalyticsQuery,
  validatePeriodComparison,
  validateCustomMetrics,
  validateFileUpload,
  sanitizeInput,
  validateRateLimit
}
