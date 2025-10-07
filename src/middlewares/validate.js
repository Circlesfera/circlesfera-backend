const logger = require('../utils/logger')

/**
 * Middleware para validar request body con esquemas Zod
 * @param {import('zod').ZodSchema} schema - Esquema Zod para validar
 * @returns {Function} Middleware de Express
 */
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Validar y transformar datos
      const validated = await schema.parseAsync(req.body)

      // Reemplazar req.body con datos validados y transformados
      req.body = validated

      next()
    } catch (error) {
      // Log de error de validación
      logger.warn('Validation error', {
        requestId: req.id,
        path: req.path,
        errors: error.errors,
        body: req.body
      })

      // Formatear errores de Zod
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))

      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      })
    }
  }
}

/**
 * Middleware para validar query params con esquemas Zod
 */
const validateQuery = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.query)
      // Crear una nueva propiedad para los query params validados
      req.validatedQuery = validated
      next()
    } catch (error) {
      logger.warn('Query validation error', {
        requestId: req.id,
        path: req.path,
        errors: error.errors
      })

      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))

      return res.status(400).json({
        success: false,
        message: 'Parámetros de consulta inválidos',
        errors
      })
    }
  }
}

/**
 * Middleware para validar params con esquemas Zod
 */
const validateParams = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req.params)
      // Crear una nueva propiedad para los params validados
      req.validatedParams = validated
      next()
    } catch (error) {
      logger.warn('Params validation error', {
        requestId: req.id,
        path: req.path,
        errors: error.errors
      })

      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))

      return res.status(400).json({
        success: false,
        message: 'Parámetros de ruta inválidos',
        errors
      })
    }
  }
}

module.exports = {
  validate,
  validateQuery,
  validateParams
}

