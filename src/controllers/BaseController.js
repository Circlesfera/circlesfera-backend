/**
 * Base Controller - Backend
 * Controlador base que proporciona funcionalidad común para todos los controladores
 * Elimina duplicación de código y asegura consistencia
 */

import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'

export class BaseController {
  /**
   * Maneja la validación de entrada de forma consistente
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {boolean} - true si la validación pasó, false si hubo errores
   */
  static handleValidation(req, res) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }
    return true
  }

  /**
   * Maneja errores de forma consistente
   * @param {Error} error - Error object
   * @param {Object} res - Response object
   * @param {string} operation - Nombre de la operación que falló
   * @param {Object} context - Contexto adicional para logging
   */
  static handleError(error, res, operation, context = {}) {
    logger.error(`Error en ${operation}:`, {
      error: error.message,
      stack: error.stack,
      ...context
    })

    // Determinar tipo de error y código de estado
    let statusCode = 500
    let message = 'Error interno del servidor'

    if (error.name === 'ValidationError') {
      statusCode = 400
      message = 'Datos inválidos'
    } else if (error.name === 'CastError') {
      statusCode = 400
      message = 'ID inválido'
    } else if (error.code === 11000) {
      statusCode = 400
      message = 'Recurso duplicado'
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401
      message = 'No autorizado'
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403
      message = 'Acceso denegado'
    } else if (error.name === 'NotFoundError') {
      statusCode = 404
      message = 'Recurso no encontrado'
    }

    return res.status(statusCode).json({
      success: false,
      message,
      code: error.code || 'UNKNOWN_ERROR'
    })
  }

  /**
   * Envía respuesta exitosa de forma consistente
   * @param {Object} res - Response object
   * @param {*} data - Datos a enviar
   * @param {string} message - Mensaje opcional
   * @param {number} statusCode - Código de estado (default: 200)
   */
  static sendSuccess(res, data, message = null, statusCode = 200) {
    const response = {
      success: true,
      data
    }

    if (message) {
      response.message = message
    }

    return res.status(statusCode).json(response)
  }

  /**
   * Envía respuesta de error de forma consistente
   * @param {Object} res - Response object
   * @param {string} message - Mensaje de error
   * @param {number} statusCode - Código de estado
   * @param {string} code - Código de error opcional
   */
  static sendError(res, message, statusCode = 400, code = null) {
    const response = {
      success: false,
      message
    }

    if (code) {
      response.code = code
    }

    return res.status(statusCode).json(response)
  }

  /**
   * Valida que un ObjectId sea válido
   * @param {string} id - ID a validar
   * @param {Object} res - Response object
   * @param {string} fieldName - Nombre del campo para el mensaje de error
   * @returns {boolean} - true si es válido, false si no
   */
  static validateObjectId(id, res, fieldName = 'ID') {
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      this.sendError(res, `${fieldName} inválido`, 400, 'INVALID_ID')
      return false
    }
    return true
  }

  /**
   * Sanitiza datos de usuario removiendo campos sensibles
   * @param {Object} user - Objeto de usuario
   * @returns {Object} - Usuario sanitizado
   */
  static sanitizeUser(user) {
    if (!user) {
      return null
    }

    const userObj = user.toObject ? user.toObject() : { ...user }

    // Remover campos sensibles
    delete userObj.password
    delete userObj.blockedUsers
    delete userObj.preferences
    delete userObj.resetPasswordToken
    delete userObj.resetPasswordExpires
    delete userObj.emailVerificationToken
    delete userObj.emailVerificationExpires

    return userObj
  }

  /**
   * Valida permisos de propiedad
   * @param {Object} resource - Recurso a validar
   * @param {string} userId - ID del usuario actual
   * @param {Object} res - Response object
   * @param {string} resourceName - Nombre del recurso para el mensaje
   * @returns {boolean} - true si tiene permisos, false si no
   */
  static validateOwnership(resource, userId, res, resourceName = 'Recurso') {
    if (!resource) {
      this.sendError(res, `${resourceName} no encontrado`, 404, 'NOT_FOUND')
      return false
    }

    const ownerId = resource.user ? resource.user.toString() : resource.userId?.toString()
    if (ownerId !== userId) {
      this.sendError(res, 'No tienes permisos para realizar esta acción', 403, 'FORBIDDEN')
      return false
    }

    return true
  }

  /**
   * Maneja paginación de forma consistente
   * @param {Object} req - Request object
   * @param {number} defaultLimit - Límite por defecto
   * @param {number} maxLimit - Límite máximo
   * @returns {Object} - Opciones de paginación
   */
  static getPaginationOptions(req, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit))
    const skip = (page - 1) * limit

    return { page, limit, skip, maxLimit }
  }

  /**
   * Crea respuesta paginada consistente
   * @param {Array} data - Datos
   * @param {Object} paginationOptions - Opciones de paginación
   * @param {number} total - Total de elementos
   * @param {Object} res - Response object
   */
  static sendPaginatedResponse(data, paginationOptions, total, res) {
    const { page, limit } = paginationOptions
    const pages = Math.ceil(total / limit)

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNextPage: page < pages,
        hasPrevPage: page > 1
      }
    })
  }

  /**
   * Wrapper para manejar operaciones asíncronas con try-catch automático
   * @param {Function} fn - Función asíncrona a ejecutar
   * @param {string} operation - Nombre de la operación para logging
   * @returns {Function} - Middleware function
   */
  static asyncHandler(fn, operation) {
    return async (req, res, next) => {
      try {
        await fn(req, res, next)
      } catch (error) {
        this.handleError(error, res, operation, {
          userId: req.user?.id,
          method: req.method,
          url: req.url
        })
      }
    }
  }

  /**
   * Valida que el usuario esté autenticado
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {boolean} - true si está autenticado, false si no
   */
  static validateAuth(req, res) {
    if (!req.user) {
      this.sendError(res, 'Token de acceso requerido', 401, 'UNAUTHORIZED')
      return false
    }
    return true
  }

  /**
   * Valida que el usuario tenga un rol específico
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {string|Array} requiredRoles - Rol(es) requerido(s)
   * @returns {boolean} - true si tiene el rol, false si no
   */
  static validateRole(req, res, requiredRoles) {
    if (!this.validateAuth(req, res)) {
      return false
    }

    const userRole = req.user.role
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]

    if (!roles.includes(userRole)) {
      this.sendError(res, 'Permisos insuficientes', 403, 'FORBIDDEN')
      return false
    }

    return true
  }
}

export default BaseController
