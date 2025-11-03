import rateLimit from 'express-rate-limit';

/**
 * Rate limiter estricto para endpoints de autenticación.
 * Previene fuerza bruta en login/register.
 * 5 intentos cada 15 minutos por IP.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Demasiados intentos de autenticación. Por favor, intenta de nuevo en 15 minutos.'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true // No contar requests exitosos
});

/**
 * Rate limiter moderado para operaciones sensibles (crear/editar posts, comentarios, etc.).
 * 30 requests por minuto por IP.
 */
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 30,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Demasiadas solicitudes. Por favor, espera un momento antes de intentar de nuevo.'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

/**
 * Rate limiter general para el resto de endpoints.
 * 120 requests por minuto por IP.
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 120,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Demasiadas solicitudes. Por favor, espera un momento antes de intentar de nuevo.'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

/**
 * Rate limiter para operaciones de búsqueda y exploración.
 * Más permisivo ya que son operaciones de lectura frecuentes.
 * 200 requests por minuto por IP.
 */
export const readOperationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 200,
  message: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Demasiadas solicitudes de lectura. Por favor, espera un momento.'
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

