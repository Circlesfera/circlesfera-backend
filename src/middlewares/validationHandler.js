/**
 * Validation Handler Middleware - Backend
 * Middleware unificado para manejar validaciones de forma consistente
 */

import { validationResult } from 'express-validator'
import BaseController from '../controllers/BaseController.js'

/**
 * Middleware para manejar validaciones de forma consistente
 * Debe usarse después de los validadores de express-validator
 */
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    return BaseController.sendError(
      res,
      'Error de validación',
      400,
      'VALIDATION_ERROR',
      errors.array()
    )
  }

  next()
}

/**
 * Middleware para validar ObjectId de parámetros de ruta
 * @param {string} paramName - Nombre del parámetro a validar
 */
export const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName]

  if (!BaseController.validateObjectId(id, res, `${paramName} inválido`)) {
    return
  }

  next()
}

/**
 * Middleware para validar que el usuario esté autenticado
 */
export const requireAuth = (req, res, next) => {
  if (!BaseController.validateAuth(req, res)) {
    return
  }

  next()
}

/**
 * Middleware para validar roles específicos
 * @param {string|Array} roles - Rol(es) requerido(s)
 */
export const requireRole = (roles) => (req, res, next) => {
  if (!BaseController.validateRole(req, res, roles)) {
    return
  }

  next()
}

/**
 * Middleware para validar que el usuario sea el propietario del recurso
 * @param {Function} getResource - Función para obtener el recurso
 * @param {string} resourceName - Nombre del recurso para mensajes de error
 */
export const requireOwnership = (getResource, resourceName = 'Recurso') => async (req, res, next) => {
  try {
    const resource = await getResource(req)

    if (!BaseController.validateOwnership(resource, req.user.id, res, resourceName)) {
      return
    }

    // Agregar el recurso al request para uso posterior
    req.resource = resource
    next()
  } catch (error) {
    BaseController.handleError(error, res, 'requireOwnership', {
      userId: req.user?.id,
      resourceName
    })
  }
}

/**
 * Middleware para validar paginación
 * @param {number} defaultLimit - Límite por defecto
 * @param {number} maxLimit - Límite máximo
 */
export const validatePagination = (defaultLimit = 20, maxLimit = 100) => (req, res, next) => {
  const { page, limit, skip } = BaseController.getPaginationOptions(req, defaultLimit, maxLimit)

  // Agregar opciones de paginación al request
  req.pagination = { page, limit, skip, maxLimit }

  next()
}

/**
 * Middleware para validar que un recurso existe
 * @param {Function} getResource - Función para obtener el recurso
 * @param {string} resourceName - Nombre del recurso para mensajes de error
 */
export const requireResourceExists = (getResource, resourceName = 'Recurso') => async (req, res, next) => {
  try {
    const resource = await getResource(req)

    if (!resource) {
      return BaseController.sendError(res, `${resourceName} no encontrado`, 404, 'NOT_FOUND')
    }

    // Agregar el recurso al request para uso posterior
    req.resource = resource
    next()
  } catch (error) {
    BaseController.handleError(error, res, 'requireResourceExists', {
      resourceName
    })
  }
}

/**
 * Middleware para validar archivos subidos
 * @param {Object} options - Opciones de validación
 */
export const validateUpload = (options = {}) => {
  const {
    required = false,
    maxFiles = 10,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    maxSize = 5 * 1024 * 1024 // 5MB por defecto
  } = options

  return (req, res, next) => {
    const { files } = req

    if (required && (!files || Object.keys(files).length === 0)) {
      return BaseController.sendError(res, 'Archivo(s) requerido(s)', 400, 'MISSING_FILES')
    }

    if (files) {
      // Validar número de archivos
      const fileCount = Object.values(files).reduce((count, file) => count + (Array.isArray(file) ? file.length : 1), 0)

      if (fileCount > maxFiles) {
        return BaseController.sendError(
          res,
          `Máximo ${maxFiles} archivos permitidos`,
          400,
          'TOO_MANY_FILES'
        )
      }

      // Validar cada archivo
      for (const [fieldName, file] of Object.entries(files)) {
        const filesArray = Array.isArray(file) ? file : [file]

        for (const singleFile of filesArray) {
          // Validar tipo
          if (!allowedTypes.includes(singleFile.mimetype)) {
            return BaseController.sendError(
              res,
              `Tipo de archivo no permitido: ${singleFile.mimetype}`,
              400,
              'INVALID_FILE_TYPE'
            )
          }

          // Validar tamaño
          if (singleFile.size > maxSize) {
            return BaseController.sendError(
              res,
              `Archivo demasiado grande: ${singleFile.originalname}`,
              400,
              'FILE_TOO_LARGE'
            )
          }
        }
      }
    }

    next()
  }
}

/**
 * Middleware para sanitizar entrada del usuario
 */
export const sanitizeInput = (req, res, next) => {
  // Sanitizar query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = value.trim()
      }
    }
  }

  // Sanitizar body
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = value.trim()
      }
    }
  }

  next()
}

/**
 * Middleware para validar límites de rate limiting por usuario
 * @param {Object} options - Opciones de rate limiting
 */
export const validateUserRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    maxRequests = 100,
    message = 'Demasiadas solicitudes'
  } = options

  // Store para mantener el conteo por usuario
  const userRequestCounts = new Map()

  // Limpiar contadores expirados cada minuto
  setInterval(() => {
    const now = Date.now()
    for (const [userId, data] of userRequestCounts.entries()) {
      if (now - data.windowStart > windowMs) {
        userRequestCounts.delete(userId)
      }
    }
  }, 60000)

  return (req, res, next) => {
    if (!req.user) {
      return next() // No aplicar rate limiting si no está autenticado
    }

    const userId = req.user.id
    const now = Date.now()
    const userData = userRequestCounts.get(userId)

    if (!userData || now - userData.windowStart > windowMs) {
      // Nueva ventana de tiempo
      userRequestCounts.set(userId, {
        count: 1,
        windowStart: now
      })
    } else {
      // Incrementar contador
      userData.count++

      if (userData.count > maxRequests) {
        return BaseController.sendError(res, message, 429, 'RATE_LIMIT_EXCEEDED')
      }
    }

    next()
  }
}

export default {
  handleValidation,
  validateObjectId,
  requireAuth,
  requireRole,
  requireOwnership,
  validatePagination,
  requireResourceExists,
  validateUpload,
  sanitizeInput,
  validateUserRateLimit
}
