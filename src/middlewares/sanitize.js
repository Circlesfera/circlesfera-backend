const logger = require('../utils/logger');

/**
 * Función para sanitizar objetos recursivamente
 * Previene NoSQL Injection y XSS básico
 * Compatible con Express 5
 */
const sanitizeObject = (obj, replaceWith = '_') => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Sanitizar claves que contengan caracteres peligrosos
    const sanitizedKey = key.replace(/[$]/g, replaceWith);
    
    if (typeof value === 'string') {
      // Sanitizar strings
      sanitized[sanitizedKey] = value
        .replace(/[<>]/g, '') // Remover < y >
        .trim();
    } else if (typeof value === 'object' && value !== null) {
      // Recursivamente sanitizar objetos anidados
      sanitized[sanitizedKey] = sanitizeObject(value, replaceWith);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized;
};

/**
 * Middleware para sanitizar MongoDB queries
 * Previene NoSQL Injection
 * Compatible con Express 5 - no modifica req.query
 */
const sanitizeMongo = (req, res, next) => {
  try {
    // Solo sanitizar body y params, no query (que es de solo lectura en Express 5)
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Error en sanitización:', error);
    next();
  }
};

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