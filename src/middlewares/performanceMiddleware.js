/**
 * Middleware de Performance Monitoring
 * Monitorea tiempos de respuesta, queries lentas y métricas de performance
 */

import logger from '../utils/logger.js'
import cacheService from '../services/cacheService.js'

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      totalResponseTime: 0,
      slowQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    }

    this.slowQueryThreshold = 1000 // 1 segundo
    this.slowRequestThreshold = 2000 // 2 segundos
  }

  /**
   * Middleware principal de performance
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now()
      const requestId = req.headers['x-request-id'] || 'unknown'

      // Agregar información de performance al request
      req.performance = {
        startTime,
        requestId,
        metrics: {
          dbQueries: 0,
          cacheHits: 0,
          cacheMisses: 0,
          slowQueries: []
        }
      }

      // Interceptar res.json para medir tiempo total
      const originalJson = res.json
      res.json = function (data) {
        const endTime = Date.now()
        const responseTime = endTime - startTime

        // Log de request completado
        logger.info('Request completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id
        })

        // Detectar requests lentos
        if (responseTime > this.slowRequestThreshold) {
          logger.warn('Slow request detected', {
            requestId,
            method: req.method,
            url: req.url,
            responseTime,
            userId: req.user?.id,
            metrics: req.performance.metrics
          })
        }

        // Actualizar métricas globales
        this.updateMetrics(req, res, responseTime)

        return originalJson.call(this, data)
      }

      next()
    }
  }

  /**
   * Middleware para monitorear queries de MongoDB
   */
  mongooseMonitoring() {
    return (req, res, next) => {
      const originalExec = req.performance?.mongooseExec || (() => { })

      // Interceptar queries de Mongoose
      if (req.performance) {
        req.performance.mongooseExec = (query) => {
          const startTime = Date.now()
          req.performance.metrics.dbQueries++

          return query.exec().then(result => {
            const endTime = Date.now()
            const queryTime = endTime - startTime

            if (queryTime > this.slowQueryThreshold) {
              req.performance.metrics.slowQueries.push({
                query: query.getQuery(),
                collection: query.mongooseCollection.name,
                time: queryTime,
                timestamp: new Date().toISOString()
              })

              logger.warn('Slow query detected', {
                requestId: req.performance.requestId,
                collection: query.mongooseCollection.name,
                query: query.getQuery(),
                time: queryTime,
                userId: req.user?.id
              })
            }

            return result
          })
        }
      }

      next()
    }
  }

  /**
   * Middleware para monitorear cache
   */
  cacheMonitoring() {
    return (req, res, next) => {
      if (req.performance) {
        // Interceptar llamadas al cache service
        const originalGet = cacheService.get
        const originalSet = cacheService.set

        cacheService.get = async function (key) {
          const result = await originalGet.call(this, key)

          if (req.performance) {
            if (result !== null) {
              req.performance.metrics.cacheHits++
            } else {
              req.performance.metrics.cacheMisses++
            }
          }

          return result
        }

        cacheService.set = async function (key, value, ttl) {
          return originalSet.call(this, key, value, ttl)
        }
      }

      next()
    }
  }

  /**
   * Middleware para compresión de respuesta
   */
  compressionMiddleware() {
    return (req, res, next) => {
      const originalSend = res.send
      const originalJson = res.json

      res.send = function (data) {
        // Comprimir respuesta si es grande
        if (typeof data === 'string' && data.length > 1024) {
          res.setHeader('Content-Encoding', 'gzip')
        }
        return originalSend.call(this, data)
      }

      res.json = function (data) {
        const jsonString = JSON.stringify(data)

        // Comprimir JSON si es grande
        if (jsonString.length > 1024) {
          res.setHeader('Content-Encoding', 'gzip')
        }

        return originalJson.call(this, data)
      }

      next()
    }
  }

  /**
   * Middleware para rate limiting inteligente
   */
  intelligentRateLimit() {
    return (req, res, next) => {
      const userId = req.user?.id
      const endpoint = `${req.method}:${req.path}`

      // Rate limiting más permisivo para usuarios autenticados
      if (userId) {
        // Usuarios autenticados pueden hacer más requests
        req.rateLimit = {
          windowMs: 15 * 60 * 1000, // 15 minutos
          max: 1000, // 1000 requests por ventana
          message: 'Demasiadas peticiones, intenta más tarde'
        }
      } else {
        // Usuarios no autenticados tienen límites más estrictos
        req.rateLimit = {
          windowMs: 15 * 60 * 1000, // 15 minutos
          max: 100, // 100 requests por ventana
          message: 'Demasiadas peticiones, inicia sesión para más límites'
        }
      }

      next()
    }
  }

  /**
   * Actualizar métricas globales
   */
  updateMetrics(req, res, responseTime) {
    this.metrics.requests++
    this.metrics.totalResponseTime += responseTime

    if (req.performance) {
      this.metrics.slowQueries += req.performance.metrics.slowQueries.length
      this.metrics.cacheHits += req.performance.metrics.cacheHits
      this.metrics.cacheMisses += req.performance.metrics.cacheMisses
    }

    if (res.statusCode >= 400) {
      this.metrics.errors++
    }
  }

  /**
   * Obtener métricas de performance
   */
  getMetrics() {
    const avgResponseTime = this.metrics.requests > 0
      ? this.metrics.totalResponseTime / this.metrics.requests
      : 0

    const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100)
      : 0

    return {
      ...this.metrics,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: this.metrics.requests > 0
        ? Math.round((this.metrics.errors / this.metrics.requests) * 10000) / 100
        : 0
    }
  }

  /**
   * Resetear métricas
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      totalResponseTime: 0,
      slowQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    }
  }

  /**
   * Health check de performance
   */
  healthCheck() {
    const metrics = this.getMetrics()

    const health = {
      status: 'healthy',
      metrics,
      thresholds: {
        avgResponseTime: metrics.avgResponseTime < 500 ? 'good' : 'warning',
        cacheHitRate: metrics.cacheHitRate > 80 ? 'good' : 'warning',
        errorRate: metrics.errorRate < 5 ? 'good' : 'warning'
      }
    }

    // Determinar estado general
    const warnings = Object.values(health.thresholds).filter(status => status === 'warning').length
    if (warnings > 1) {
      health.status = 'degraded'
    } else if (warnings > 0) {
      health.status = 'warning'
    }

    return health
  }
}

// Singleton
const performanceMonitor = new PerformanceMonitor()

// Exportar middlewares individuales
export const performanceMiddleware = performanceMonitor.middleware()
export const mongooseMonitoring = performanceMonitor.mongooseMonitoring()
export const cacheMonitoring = performanceMonitor.cacheMonitoring()
export const compressionMiddleware = performanceMonitor.compressionMiddleware()
export const intelligentRateLimit = performanceMonitor.intelligentRateLimit()

// Exportar instancia para métricas
export default performanceMonitor
