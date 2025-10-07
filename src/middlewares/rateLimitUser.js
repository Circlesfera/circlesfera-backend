const rateLimit = require('express-rate-limit')
const { config } = require('../utils/config')
const logger = require('../utils/logger')

/**
 * Rate limiter por IP (general)
 */
const ipLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.isDevelopment ? 1000 : config.rateLimitMaxRequests,
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, intenta más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      requestId: req.id,
      path: req.path
    })
    res.status(429).json({
      success: false,
      message: 'Demasiadas solicitudes, intenta más tarde'
    })
  }
})

/**
 * Rate limiter por usuario autenticado
 * 100 requests por minuto por usuario
 */
const userLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: config.isDevelopment ? 1000 : 100,
  keyGenerator: (req) => {
    // Si hay userId, usar ese, sino usar IP
    return req.userId?.toString() || req.ip
  },
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for user: ${req.userId || req.ip}`, {
      requestId: req.id,
      path: req.path
    })
    res.status(429).json({
      success: false,
      message: 'Has excedido el límite de solicitudes. Espera un momento.'
    })
  }
})

/**
 * Rate limiter estricto para acciones sensibles
 * Solo 10 intentos por hora
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: config.isDevelopment ? 100 : 10,
  skipSuccessfulRequests: true, // No contar requests exitosos
  keyGenerator: (req) => {
    return req.userId?.toString() || req.ip
  },
  handler: (req, res) => {
    logger.warn(`Strict rate limit exceeded: ${req.userId || req.ip}`, {
      requestId: req.id,
      path: req.path
    })
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos. Por favor espera una hora.'
    })
  }
})

/**
 * Rate limiter para creación de contenido
 * Previene spam
 */
const contentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: config.isDevelopment ? 100 : 10, // 10 posts/minuto
  keyGenerator: (req) => {
    return req.userId?.toString() || req.ip
  },
  handler: (req, res) => {
    logger.warn(`Content creation rate limit exceeded: ${req.userId}`, {
      requestId: req.id,
      path: req.path
    })
    res.status(429).json({
      success: false,
      message: 'Estás creando contenido demasiado rápido. Espera un momento.'
    })
  }
})

module.exports = {
  ipLimiter,
  userLimiter,
  strictLimiter,
  contentLimiter
}

