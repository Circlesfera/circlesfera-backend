import AnalyticsService from '../services/analyticsService.js'
import analyticsSocketService from '../services/analyticsSocketService.js'
import logger from '../utils/logger.js'

/**
 * Función para detectar la plataforma basada en User-Agent
 */
const detectPlatform = (userAgent) => {
  if (!userAgent) { return 'unknown' }

  const ua = userAgent.toLowerCase()

  if (ua.includes('mobile') || ua.includes('android')) {
    return 'mobile'
  }
  if (ua.includes('iphone') || ua.includes('ipad')) {
    return 'ios'
  }
  if (ua.includes('windows')) {
    return 'windows'
  }
  if (ua.includes('mac')) {
    return 'mac'
  }
  if (ua.includes('linux')) {
    return 'linux'
  }

  return 'web'
}

/**
 * Middleware para tracking automático de eventos de analytics
 */
export const trackAnalyticsEvent = (eventType, options = {}) => async (req, res, next) => {
  try {
    // No trackear si es una petición de analytics o health check
    if (req.path.includes('/analytics') || req.path.includes('/health')) {
      return next()
    }

    // Extraer información de la petición
    const eventData = {
      eventType,
      userId: req.user?._id,
      sessionId: req.sessionID || req.headers['x-session-id'],
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      platform: detectPlatform(req.get('User-Agent')),
      appVersion: req.headers['x-app-version'],
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        ...options.metadata
      },
      category: options.category,
      severity: options.severity || 'low',
      tags: options.tags || []
    }

    // Agregar información específica según el tipo de evento
    if (options.extractFromRequest) {
      Object.assign(eventData, options.extractFromRequest(req))
    }

    // Trackear evento de forma asíncrona (no bloquear la respuesta)
    setImmediate(async () => {
      try {
        await AnalyticsService.trackEvent(eventData)
      } catch (error) {
        logger.error('Error tracking analytics event:', error)
      }
    })

    next()
  } catch (error) {
    logger.error('Error in analytics tracking middleware:', error)
    next() // Continuar aunque falle el tracking
  }
}

/**
 * Middleware para tracking de performance
 */
export const trackPerformance = (options = {}) => (req, res, next) => {
  const startTime = Date.now()

  // Interceptar el método end para medir tiempo de respuesta
  const originalEnd = res.end
  res.end = function (...args) {
    const responseTime = Date.now() - startTime

    // Trackear métricas de performance de forma asíncrona
    setImmediate(async () => {
      try {
        await AnalyticsService.trackEvent({
          eventType: 'performance_metric',
          userId: req.user?._id,
          sessionId: req.sessionID || req.headers['x-session-id'],
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip || req.connection.remoteAddress,
          platform: detectPlatform(req.get('User-Agent')),
          performance: {
            responseTime,
            loadTime: responseTime, // En este caso es lo mismo
            errorOccurred: res.statusCode >= 400,
            errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null
          },
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            contentLength: res.get('Content-Length') || 0
          },
          category: 'system',
          severity: res.statusCode >= 500 ? 'high' : res.statusCode >= 400 ? 'medium' : 'low'
        })
      } catch (error) {
        logger.error('Error tracking performance metrics:', error)
      }
    })

    originalEnd.apply(this, args)
  }

  next()
}

/**
 * Middleware específico para tracking de autenticación
 */
export const trackAuthEvents = () => trackAnalyticsEvent('user_login', {
  category: 'user_activity',
  extractFromRequest: (req, res) => ({
    metadata: {
      loginMethod: req.body?.method || 'password',
      success: res.statusCode < 400
    }
  })
})

/**
 * Middleware específico para tracking de creación de contenido
 */
export const trackContentCreation = (contentType) => trackAnalyticsEvent(`${contentType}_create`, {
  category: 'content_interaction',
  extractFromRequest: (req) => ({
    contentId: req.body?._id || req.params?.id,
    contentType,
    metadata: {
      hasMedia: !!(req.body?.media && req.body.media.length > 0),
      mediaCount: req.body?.media?.length || 0,
      captionLength: req.body?.caption?.length || 0
    }
  })
})

/**
 * Middleware específico para tracking de interacciones sociales
 */
export const trackSocialInteraction = (interactionType) => trackAnalyticsEvent(interactionType, {
  category: 'social_action',
  extractFromRequest: (req) => ({
    targetUserId: req.params?.userId || req.body?.targetUserId,
    metadata: {
      targetType: req.params?.targetType || 'user'
    }
  })
})

/**
 * Middleware específico para tracking de reportes
 */
export const trackReportEvents = () => trackAnalyticsEvent('content_report', {
  category: 'system',
  severity: 'high',
  extractFromRequest: (req) => ({
    targetUserId: req.body?.targetUserId,
    contentId: req.body?.contentId,
    contentType: req.body?.contentType,
    metadata: {
      reason: req.body?.reason,
      description: req.body?.description
    }
  })
})

/**
 * Middleware específico para tracking de administración
 */
export const trackAdminActions = (actionType) => trackAnalyticsEvent('admin_action', {
  category: 'admin',
  severity: 'high',
  extractFromRequest: (req) => ({
    targetUserId: req.params?.userId || req.body?.targetUserId,
    metadata: {
      action: actionType,
      targetType: req.params?.targetType || 'user',
      reason: req.body?.reason,
      details: req.body
    }
  })
})

/**
 * Middleware para tracking de errores
 */
export const trackErrors = () => (error, req, res, next) => {
  // Trackear error de forma asíncrona
  setImmediate(async () => {
    try {
      await AnalyticsService.trackEvent({
        eventType: 'system_error',
        userId: req.user?._id,
        sessionId: req.sessionID || req.headers['x-session-id'],
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        platform: detectPlatform(req.get('User-Agent')),
        performance: {
          errorOccurred: true,
          errorMessage: error.message
        },
        metadata: {
          method: req.method,
          path: req.path,
          errorStack: error.stack,
          errorName: error.name,
          statusCode: res.statusCode
        },
        category: 'system',
        severity: 'critical',
        tags: ['error', 'exception']
      })
    } catch (trackingError) {
      logger.error('Error tracking system error:', trackingError)
    }
  })

  next(error)
}


/**
 * Función para obtener información de geolocalización (requiere servicio externo)
 */
const getLocationFromIP = async (ipAddress) =>
// Implementación simplificada - en producción usar un servicio como MaxMind
// Por ahora retornamos datos de ejemplo
  ({
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown'
  })


/**
 * Middleware para enriquecer eventos con información geográfica
 */
export const enrichWithGeographicData = () => async (req, res, next) => {
  try {
    // Agregar información geográfica a req para uso posterior
    if (!req.geoData) {
      req.geoData = await getLocationFromIP(req.ip || req.connection.remoteAddress)
    }
    next()
  } catch (error) {
    logger.error('Error enriching with geographic data:', error)
    next() // Continuar aunque falle
  }
}

/**
 * Función para limpiar datos sensibles antes de trackear
 */
const sanitizeEventData = (eventData) => {
  // Remover información sensible
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth']

  const cleanObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) { return obj }

    const cleaned = Array.isArray(obj) ? [] : {}

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        cleaned[key] = '[REDACTED]'
      } else if (typeof value === 'object') {
        cleaned[key] = cleanObject(value)
      } else {
        cleaned[key] = value
      }
    }

    return cleaned
  }

  return cleanObject(eventData)
}

/**
 * Middleware para sanitizar datos antes de trackear
 */
export const sanitizeAnalyticsData = () => (req, res, next) => {
  // Interceptar el método end para sanitizar datos
  const originalEnd = res.end
  res.end = function (...args) {
    // Sanitizar datos sensibles en req.body, req.query, etc.
    if (req.body) {
      req.body = sanitizeEventData(req.body)
    }
    if (req.query) {
      req.query = sanitizeEventData(req.query)
    }

    originalEnd.apply(this, args)
  }

  next()
}

export default {
  trackAnalyticsEvent,
  trackPerformance,
  trackAuthEvents,
  trackContentCreation,
  trackSocialInteraction,
  trackReportEvents,
  trackAdminActions,
  trackErrors,
  enrichWithGeographicData,
  sanitizeAnalyticsData
}
