import monitoringService from '../utils/monitoring.js'

/**
 * Middleware de monitoreo para registrar peticiones y métricas
 */
const monitoringMiddleware = (req, res, next) => {
  const startTime = Date.now()

  // Interceptar el método end para registrar métricas
  const originalEnd = res.end
  res.end = function (...args) {
    const responseTime = Date.now() - startTime

    // Registrar la petición
    monitoringService.recordRequest(req, res, responseTime)

    // Llamar al método original
    originalEnd.apply(this, args)
  }

  next()
}

/**
 * Middleware para manejo de errores con monitoreo
 */
const errorMonitoringMiddleware = (err, req, res, next) => {
  const endpoint = `${req.method} ${req.route?.path || req.path}`

  // Registrar el error
  monitoringService.recordError(err, endpoint)

  next(err)
}

/**
 * Middleware para monitoreo de caché
 */
const cacheMonitoringMiddleware = (req, res, next) => {
  const originalJson = res.json
  res.json = function (data) {
    // Verificar si la respuesta viene del caché
    if (req.fromCache) {
      monitoringService.recordCacheHit()
    } else {
      monitoringService.recordCacheMiss()
    }

    return originalJson.call(this, data)
  }

  next()
}

export {
  monitoringMiddleware,
  errorMonitoringMiddleware,
  cacheMonitoringMiddleware
}
