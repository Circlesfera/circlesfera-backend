/**
 * Utilidades para formatear respuestas de la API de manera consistente
 * Todas las respuestas deben seguir el formato estándar
 */

/**
 * Formatear respuesta exitosa
 * @param {Object} res - Objeto de respuesta de Express
 * @param {any} data - Datos a devolver
 * @param {string} message - Mensaje opcional
 * @param {number} statusCode - Código de estado HTTP (por defecto 200)
 */
export const sendSuccess = (res, data, message = null, statusCode = 200) => {
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
 * Formatear respuesta exitosa con paginación
 * @param {Object} res - Objeto de respuesta de Express
 * @param {Array} data - Array de datos a devolver
 * @param {Object} pagination - Información de paginación
 * @param {string} message - Mensaje opcional
 */
export const sendSuccessWithPagination = (res, data, pagination, message = null) => {
  const response = {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    }
  }

  if (message) {
    response.message = message
  }

  return res.status(200).json(response)
}

/**
 * Formatear respuesta de error
 * @param {Object} res - Objeto de respuesta de Express
 * @param {string} message - Mensaje de error
 * @param {number} statusCode - Código de estado HTTP (por defecto 400)
 * @param {Array} errors - Array de errores de validación (opcional)
 */
export const sendError = (res, message, statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message
  }

  if (errors && errors.length > 0) {
    response.errors = errors
  }

  return res.status(statusCode).json(response)
}

/**
 * Formatear respuesta de recurso creado
 * @param {Object} res - Objeto de respuesta de Express
 * @param {any} data - Datos del recurso creado
 * @param {string} message - Mensaje opcional
 */
export const sendCreated = (res, data, message = 'Recurso creado exitosamente') => sendSuccess(res, data, message, 201)

/**
 * Formatear respuesta de recurso no encontrado
 * @param {Object} res - Objeto de respuesta de Express
 * @param {string} message - Mensaje personalizado (opcional)
 */
export const sendNotFound = (res, message = 'Recurso no encontrado') => sendError(res, message, 404)

/**
 * Formatear respuesta de no autorizado
 * @param {Object} res - Objeto de respuesta de Express
 * @param {string} message - Mensaje personalizado (opcional)
 */
export const sendUnauthorized = (res, message = 'No autorizado') => sendError(res, message, 401)

/**
 * Formatear respuesta de prohibido (sin permisos)
 * @param {Object} res - Objeto de respuesta de Express
 * @param {string} message - Mensaje personalizado (opcional)
 */
export const sendForbidden = (res, message = 'Acceso denegado') => sendError(res, message, 403)

/**
 * Formatear respuesta de validación fallida
 * @param {Object} res - Objeto de respuesta de Express
 * @param {Array} errors - Array de errores de validación
 * @param {string} message - Mensaje personalizado (opcional)
 */
export const sendValidationError = (res, errors, message = 'Error de validación') => sendError(res, message, 400, errors)

/**
 * Formatear respuesta de error del servidor
 * @param {Object} res - Objeto de respuesta de Express
 * @param {Error} error - Objeto de error
 * @param {boolean} isDevelopment - Si está en modo desarrollo
 */
export const sendServerError = (res, error, isDevelopment = false) => {
  const response = {
    success: false,
    message: isDevelopment ? error.message : 'Error interno del servidor'
  }

  if (isDevelopment && error.stack) {
    response.stack = error.stack
  }

  return res.status(500).json(response)
}

/**
 * Formatear respuesta sin contenido
 * @param {Object} res - Objeto de respuesta de Express
 */
export const sendNoContent = (res) => res.status(204).send()

