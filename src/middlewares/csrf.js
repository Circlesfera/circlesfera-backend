/**
 * Middleware de Protección CSRF (Cross-Site Request Forgery)
 * Implementación moderna usando doble submit cookie pattern
 *
 * Estrategia:
 * 1. Generar token CSRF al login/registro
 * 2. Almacenar en cookie HttpOnly + SameSite
 * 3. Cliente debe enviar token en header X-CSRF-Token
 * 4. Verificar que coincidan en peticiones mutativas (POST, PUT, DELETE, PATCH)
 */

import crypto from 'crypto'
import logger from '../utils/logger.js'
import { config } from '../utils/config.js'

/**
 * Nombre de la cookie CSRF
 */
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'

/**
 * Nombre del header donde el cliente envía el token
 */
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Generar token CSRF aleatorio
 * @returns {string} Token CSRF
 */
export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Establecer cookie CSRF en la respuesta
 * @param {object} res - Response de Express
 * @param {string} token - Token CSRF (opcional, genera uno nuevo si no se proporciona)
 * @returns {string} Token CSRF
 */
export function setCsrfCookie(res, token = null) {
  const csrfToken = token || generateCsrfToken()

  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // El cliente necesita leer este token para enviarlo en el header
    secure: config.isProduction, // Solo HTTPS en producción
    sameSite: config.isProduction ? 'strict' : 'lax', // Protección adicional
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    path: '/'
  })

  return csrfToken
}

/**
 * Middleware para generar y establecer token CSRF
 * Usado en login/register
 */
export function provideCsrfToken(req, res, next) {
  try {
    const token = generateCsrfToken()
    setCsrfCookie(res, token)

    // Adjuntar al request para usarlo en respuesta JSON si es necesario
    req.csrfToken = token

    next()
  } catch (error) {
    logger.error('Error al generar token CSRF:', error)
    // No bloquear la petición
    next()
  }
}

/**
 * Middleware de protección CSRF
 * Verifica que el token en el header coincida con el de la cookie
 * @param {object} options - Opciones de configuración
 * @returns {Function} Middleware
 */
export function csrfProtection(options = {}) {
  const {
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'], // Métodos que no requieren CSRF
    ignoreOrigin = false // Si es true, no verifica origin (solo para desarrollo)
  } = options

  return (req, res, next) => {
    try {
      const method = req.method.toUpperCase()

      // Ignorar métodos seguros (no mutables)
      if (ignoreMethods.includes(method)) {
        return next()
      }

      // En desarrollo, ser más permisivo si está configurado
      if (config.isDevelopment && ignoreOrigin) {
        logger.debug('CSRF protection bypassed in development')
        return next()
      }

      // Obtener token de la cookie
      const cookieToken = req.cookies[CSRF_COOKIE_NAME]

      if (!cookieToken) {
        logger.warn('CSRF token missing in cookie', {
          method,
          path: req.path,
          ip: req.ip
        })

        return res.status(403).json({
          success: false,
          message: 'Token CSRF no encontrado. Recarga la página e intenta nuevamente.',
          code: 'CSRF_MISSING_COOKIE'
        })
      }

      // Obtener token del header
      const headerToken = req.get(CSRF_HEADER_NAME) || req.body._csrf

      if (!headerToken) {
        logger.warn('CSRF token missing in header/body', {
          method,
          path: req.path,
          ip: req.ip,
          userId: req.user?._id
        })

        return res.status(403).json({
          success: false,
          message: 'Token CSRF no proporcionado. Incluye el header X-CSRF-Token.',
          code: 'CSRF_MISSING_HEADER'
        })
      }

      // Verificar que los tokens coincidan (comparación constante en tiempo)
      if (!timingSafeEqual(cookieToken, headerToken)) {
        logger.warn('CSRF token mismatch', {
          method,
          path: req.path,
          ip: req.ip,
          userId: req.user?._id
        })

        return res.status(403).json({
          success: false,
          message: 'Token CSRF inválido. Recarga la página e intenta nuevamente.',
          code: 'CSRF_INVALID'
        })
      }

      // CSRF válido
      logger.debug('CSRF token validated successfully', {
        method,
        path: req.path,
        userId: req.user?._id
      })

      next()
    } catch (error) {
      logger.error('Error en protección CSRF:', error)

      // En producción, rechazar por seguridad
      if (config.isProduction) {
        return res.status(500).json({
          success: false,
          message: 'Error al validar protección CSRF'
        })
      }

      // En desarrollo, permitir continuar (fail-open para desarrollo)
      logger.warn('CSRF protection error in development, allowing request')
      next()
    }
  }
}

/**
 * Comparación constante en tiempo para evitar timing attacks
 * @param {string} a - Primera cadena
 * @param {string} b - Segunda cadena
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false
  }

  try {
    const bufferA = Buffer.from(a, 'utf-8')
    const bufferB = Buffer.from(b, 'utf-8')
    return crypto.timingSafeEqual(bufferA, bufferB)
  } catch (error) {
    logger.error('Error en comparación de tokens:', error)
    return false
  }
}

/**
 * Renovar token CSRF (útil después de login exitoso)
 */
export function refreshCsrfToken(req, res, next) {
  try {
    const newToken = generateCsrfToken()
    setCsrfCookie(res, newToken)
    req.csrfToken = newToken
    next()
  } catch (error) {
    logger.error('Error al renovar token CSRF:', error)
    next()
  }
}

/**
 * Limpiar cookie CSRF (útil en logout)
 */
export function clearCsrfCookie(req, res, next) {
  try {
    res.clearCookie(CSRF_COOKIE_NAME, {
      httpOnly: false,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'strict' : 'lax',
      path: '/'
    })
    next()
  } catch (error) {
    logger.error('Error al limpiar cookie CSRF:', error)
    next()
  }
}

/**
 * Middleware para agregar token CSRF a respuestas JSON
 * (para que el cliente pueda obtenerlo)
 */
export function includeCsrfInResponse(req, res, next) {
  // Interceptar res.json para agregar csrfToken
  const originalJson = res.json.bind(res)

  res.json = function (data) {
    if (req.csrfToken) {
      // Agregar token a la respuesta si existe
      data.csrfToken = req.csrfToken
    }
    return originalJson(data)
  }

  next()
}

export default csrfProtection

