/**
 * 🚨 ERROR HANDLER MIDDLEWARE
 * ===========================
 * Middleware centralizado para manejo de errores
 * Proporciona respuestas consistentes y logging estructurado
 */

import logger from '../utils/logger.js'
import { config } from '../utils/config.js'

/**
 * Clase personalizada para errores de la aplicación
 */
export class AppError extends Error {
  constructor(message, statusCode, code = null, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
    this.timestamp = new Date().toISOString()

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Errores predefinidos comunes
 */
export const ErrorTypes = {
  // Errores de validación
  VALIDATION_ERROR: (message = 'Datos de entrada inválidos') =>
    new AppError(message, 400, 'VALIDATION_ERROR'),

  // Errores de autenticación
  UNAUTHORIZED: (message = 'No autorizado') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  FORBIDDEN: (message = 'Acceso denegado') =>
    new AppError(message, 403, 'FORBIDDEN'),

  // Errores de recursos
  NOT_FOUND: (message = 'Recurso no encontrado') =>
    new AppError(message, 404, 'NOT_FOUND'),

  CONFLICT: (message = 'Conflicto de recursos') =>
    new AppError(message, 409, 'CONFLICT'),

  // Errores de rate limiting
  RATE_LIMIT_EXCEEDED: (message = 'Demasiadas solicitudes') =>
    new AppError(message, 429, 'RATE_LIMIT_EXCEEDED'),

  // Errores del servidor
  INTERNAL_ERROR: (message = 'Error interno del servidor') =>
    new AppError(message, 500, 'INTERNAL_ERROR'),

  SERVICE_UNAVAILABLE: (message = 'Servicio no disponible') =>
    new AppError(message, 503, 'SERVICE_UNAVAILABLE')
}

/**
 * Maneja errores de MongoDB
 */
const handleMongoError = (error) => {
  let message = 'Error de base de datos'
  let statusCode = 500

  switch (error.name) {
    case 'ValidationError':
      const validationErrors = Object.values(error.errors).map(err => err.message)
      message = `Error de validación: ${validationErrors.join(', ')}`
      statusCode = 400
      break

    case 'CastError':
      message = `ID inválido: ${error.value}`
      statusCode = 400
      break

    case 'MongoServerError':
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0]
        message = `${field} ya existe`
        statusCode = 409
      } else {
        message = 'Error del servidor de base de datos'
        statusCode = 500
      }
      break

    case 'MongoNetworkError':
      message = 'Error de conexión a la base de datos'
      statusCode = 503
      break

    default:
      message = 'Error de base de datos'
      statusCode = 500
  }

  return new AppError(message, statusCode, 'DATABASE_ERROR')
}

/**
 * Maneja errores de JWT
 */
const handleJWTError = (error) => {
  let message = 'Token inválido'
  const statusCode = 401

  switch (error.name) {
    case 'JsonWebTokenError':
      message = 'Token de acceso inválido'
      break
    case 'TokenExpiredError':
      message = 'Token de acceso expirado'
      break
    case 'NotBeforeError':
      message = 'Token no válido aún'
      break
  }

  return new AppError(message, statusCode, 'JWT_ERROR')
}

/**
 * Maneja errores de validación de express-validator
 */
const handleValidationError = (error) => {
  const errors = error.errors.map(err => ({
    field: err.path,
    message: err.msg,
    value: err.value
  }))

  return new AppError('Datos de entrada inválidos', 400, 'VALIDATION_ERROR', true, errors)
}

/**
 * Envía respuesta de error al cliente
 */
const sendErrorResponse = (err, req, res) => {
  const { statusCode, message, code, timestamp } = err

  // Respuesta básica
  const errorResponse = {
    success: false,
    message,
    code,
    timestamp,
    path: req.originalUrl,
    method: req.method
  }

  // Agregar detalles adicionales en desarrollo
  if (config.env === 'development') {
    errorResponse.stack = err.stack
    errorResponse.details = err.details || null
  }

  // Agregar request ID si está disponible
  if (req.requestId) {
    errorResponse.requestId = req.requestId
  }

  res.status(statusCode).json(errorResponse)
}

/**
 * Middleware principal de manejo de errores
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message

  // Log del error
  logger.error('Error capturado:', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      requestId: req.requestId
    }
  })

  // Manejar diferentes tipos de errores
  if (err.name === 'ValidationError') {
    error = handleMongoError(err)
  } else if (err.name === 'CastError') {
    error = handleMongoError(err)
  } else if (err.name === 'MongoServerError') {
    error = handleMongoError(err)
  } else if (err.name === 'MongoNetworkError') {
    error = handleMongoError(err)
  } else if (err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError' ||
    err.name === 'NotBeforeError') {
    error = handleJWTError(err)
  } else if (err.name === 'ValidationError' && err.errors) {
    error = handleValidationError(err)
  } else if (!error.isOperational) {
    // Errores no operacionales (programming errors)
    error = new AppError('Algo salió mal', 500, 'INTERNAL_ERROR')
  }

  // Enviar respuesta de error
  sendErrorResponse(error, req, res)
}

/**
 * Middleware para manejar rutas no encontradas
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Ruta ${req.originalUrl} no encontrada`,
    404,
    'NOT_FOUND'
  )
  next(error)
}

/**
 * Middleware para manejar errores asíncronos
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Middleware para manejar errores de WebSocket
 */
export const socketErrorHandler = (socket, next) => {
  socket.on('error', (error) => {
    logger.error('Error de WebSocket:', {
      error: {
        message: error.message,
        stack: error.stack
      },
      socket: {
        id: socket.id,
        userId: socket.userId
      }
    })
  })
  next()
}

/**
 * Función para crear errores personalizados
 */
export const createError = (message, statusCode, code) => new AppError(message, statusCode, code)

/**
 * Función para lanzar errores
 */
export const throwError = (message, statusCode, code) =>
  new AppError(message, statusCode, code)

/**
 * Middleware para manejar errores de rate limiting
 */
export const rateLimitErrorHandler = (req, res) => {
  const error = new AppError(
    'Demasiadas solicitudes. Intenta más tarde.',
    429,
    'RATE_LIMIT_EXCEEDED'
  )

  res.status(429).json({
    success: false,
    message: error.message,
    code: error.code,
    timestamp: error.timestamp,
    retryAfter: req.rateLimit?.resetTime || 60
  })
}

/**
 * Middleware para manejar errores de CORS
 */
export const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    const error = new AppError(
      'Acceso denegado por CORS',
      403,
      'CORS_ERROR'
    )
    return sendErrorResponse(error, req, res)
  }
  next(err)
}

/**
 * Middleware para manejar errores de archivos
 */
export const fileErrorHandler = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    const error = new AppError(
      'Archivo demasiado grande',
      413,
      'FILE_TOO_LARGE'
    )
    return sendErrorResponse(error, req, res)
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const error = new AppError(
      'Demasiados archivos',
      413,
      'TOO_MANY_FILES'
    )
    return sendErrorResponse(error, req, res)
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const error = new AppError(
      'Campo de archivo inesperado',
      400,
      'UNEXPECTED_FILE_FIELD'
    )
    return sendErrorResponse(error, req, res)
  }

  next(err)
}

/**
 * Función para manejar errores de promesas no capturadas
 */
export const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
      reason: reason.message || reason,
      stack: reason.stack,
      promise
    })

    // Cerrar el servidor de forma elegante
    process.exit(1)
  })
}

/**
 * Función para manejar excepciones no capturadas
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack
    })

    // Cerrar el servidor de forma elegante
    process.exit(1)
  })
}

export default {
  AppError,
  ErrorTypes,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  socketErrorHandler,
  createError,
  throwError,
  rateLimitErrorHandler,
  corsErrorHandler,
  fileErrorHandler,
  handleUnhandledRejection,
  handleUncaughtException
}
