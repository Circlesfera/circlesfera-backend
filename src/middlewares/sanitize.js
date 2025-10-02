const mongoSanitize = require('express-mongo-sanitize');
const logger = require('../utils/logger');

/**
 * Middleware para sanitizar MongoDB queries
 * Previene NoSQL Injection
 * Compatible con Express 5
 */
const sanitizeMongo = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitized potentially malicious key: ${key}`, {
      ip: req.ip,
      path: req.path,
    });
  },
  // Configuración específica para Express 5 - no modificar req.query
  dryRun: false,
  allowDots: false,
  // Solo sanitizar body y params, no query
  sanitizeKeys: ['body', 'params'],
});

/**
 * Sanitizar strings de caracteres peligrosos
 * Previene XSS básico
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  return str
    .replace(/[<>]/g, '') // Remover < y >
    .trim();
};

/**
 * Sanitizar objeto recursivamente
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Middleware para sanitizar body de requests
 */
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

module.exports = {
  sanitizeMongo,
  sanitizeString,
  sanitizeObject,
  sanitizeBody,
};

