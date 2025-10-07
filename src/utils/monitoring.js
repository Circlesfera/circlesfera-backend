const logger = require('./logger')
const cache = require('./cache')

/**
 * Sistema de monitoreo para CircleSfera
 * Proporciona métricas y monitoreo de la aplicación
 */
class MonitoringService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
        byStatus: new Map()
      },
      performance: {
        responseTimes: [],
        cacheHits: 0,
        cacheMisses: 0,
        dbQueries: 0,
        dbQueryTime: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        byEndpoint: new Map()
      },
      users: {
        active: new Set(),
        total: 0,
        newToday: 0
      }
    }

    this.startTime = Date.now()
    this.cleanupInterval = null
    this.startCleanup()
  }

  /**
   * Registrar una petición HTTP
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {number} responseTime - Tiempo de respuesta en ms
   */
  recordRequest(req, res, responseTime) {
    this.metrics.requests.total++

    // Por endpoint
    const endpoint = `${req.method} ${req.route?.path || req.path}`
    const endpointCount = this.metrics.requests.byEndpoint.get(endpoint) || 0
    this.metrics.requests.byEndpoint.set(endpoint, endpointCount + 1)

    // Por método
    const methodCount = this.metrics.requests.byMethod.get(req.method) || 0
    this.metrics.requests.byMethod.set(req.method, methodCount + 1)

    // Por status
    const statusCount = this.metrics.requests.byStatus.get(res.statusCode) || 0
    this.metrics.requests.byStatus.set(res.statusCode, statusCount + 1)

    // Tiempo de respuesta
    this.metrics.performance.responseTimes.push(responseTime)

    // Mantener solo los últimos 1000 tiempos de respuesta
    if (this.metrics.performance.responseTimes.length > 1000) {
      this.metrics.performance.responseTimes = this.metrics.performance.responseTimes.slice(-1000)
    }
  }

  /**
   * Registrar un error
   * @param {Error} error - Error object
   * @param {string} endpoint - Endpoint donde ocurrió el error
   */
  recordError(error, endpoint) {
    this.metrics.errors.total++

    // Por tipo de error
    const errorType = error.name || 'UnknownError'
    const typeCount = this.metrics.errors.byType.get(errorType) || 0
    this.metrics.errors.byType.set(errorType, typeCount + 1)

    // Por endpoint
    const endpointCount = this.metrics.errors.byEndpoint.get(endpoint) || 0
    this.metrics.errors.byEndpoint.set(endpoint, endpointCount + 1)

    logger.error('Error registrado:', {
      type: errorType,
      message: error.message,
      endpoint,
      stack: error.stack
    })
  }

  /**
   * Registrar hit de caché
   */
  recordCacheHit() {
    this.metrics.performance.cacheHits++
  }

  /**
   * Registrar miss de caché
   */
  recordCacheMiss() {
    this.metrics.performance.cacheMisses++
  }

  /**
   * Registrar consulta a base de datos
   * @param {number} queryTime - Tiempo de la consulta en ms
   */
  recordDbQuery(queryTime) {
    this.metrics.performance.dbQueries++
    this.metrics.performance.dbQueryTime += queryTime
  }

  /**
   * Registrar usuario activo
   * @param {string} userId - ID del usuario
   */
  recordActiveUser(userId) {
    this.metrics.users.active.add(userId)
  }

  /**
   * Remover usuario activo
   * @param {string} userId - ID del usuario
   */
  removeActiveUser(userId) {
    this.metrics.users.active.delete(userId)
  }

  /**
   * Obtener estadísticas del sistema
   * @returns {Object} Estadísticas del sistema
   */
  getStats() {
    const uptime = Date.now() - this.startTime
    const avgResponseTime = this.metrics.performance.responseTimes.length > 0
      ? this.metrics.performance.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.performance.responseTimes.length
      : 0

    const cacheHitRate = this.metrics.performance.cacheHits + this.metrics.performance.cacheMisses > 0
      ? (this.metrics.performance.cacheHits / (this.metrics.performance.cacheHits + this.metrics.performance.cacheMisses)) * 100
      : 0

    const avgDbQueryTime = this.metrics.performance.dbQueries > 0
      ? this.metrics.performance.dbQueryTime / this.metrics.performance.dbQueries
      : 0

    return {
      uptime: {
        milliseconds: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
        hours: Math.floor(uptime / 3600000)
      },
      requests: {
        total: this.metrics.requests.total,
        perMinute: this.metrics.requests.total / (uptime / 60000),
        byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
        byMethod: Object.fromEntries(this.metrics.requests.byMethod),
        byStatus: Object.fromEntries(this.metrics.requests.byStatus)
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        cacheHits: this.metrics.performance.cacheHits,
        cacheMisses: this.metrics.performance.cacheMisses,
        dbQueries: this.metrics.performance.dbQueries,
        avgDbQueryTime: Math.round(avgDbQueryTime * 100) / 100
      },
      errors: {
        total: this.metrics.errors.total,
        byType: Object.fromEntries(this.metrics.errors.byType),
        byEndpoint: Object.fromEntries(this.metrics.errors.byEndpoint)
      },
      users: {
        active: this.metrics.users.active.size,
        total: this.metrics.users.total,
        newToday: this.metrics.users.newToday
      },
      cache: cache.getStats(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  }

  /**
   * Obtener métricas de salud del sistema
   * @returns {Object} Estado de salud del sistema
   */
  getHealthStatus() {
    const stats = this.getStats()
    const issues = []

    // Verificar tiempo de respuesta promedio
    if (stats.performance.avgResponseTime > 1000) {
      issues.push({
        type: 'performance',
        message: `Tiempo de respuesta promedio alto: ${stats.performance.avgResponseTime}ms`
      })
    }

    // Verificar tasa de errores
    const errorRate = stats.requests.total > 0 ? (stats.errors.total / stats.requests.total) * 100 : 0
    if (errorRate > 5) {
      issues.push({
        type: 'errors',
        message: `Tasa de errores alta: ${errorRate.toFixed(2)}%`
      })
    }

    // Verificar uso de memoria
    const memoryUsage = stats.memory.heapUsed / stats.memory.heapTotal
    if (memoryUsage > 0.9) {
      issues.push({
        type: 'memory',
        message: `Uso de memoria alto: ${(memoryUsage * 100).toFixed(2)}%`
      })
    }

    // Verificar caché
    if (stats.performance.cacheHitRate < 50) {
      issues.push({
        type: 'cache',
        message: `Tasa de hit de caché baja: ${stats.performance.cacheHitRate.toFixed(2)}%`
      })
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      issues,
      stats,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Limpiar métricas antiguas
   */
  cleanup() {
    // Limpiar usuarios activos antiguos (simular timeout)
    // En una implementación real, esto se haría con timestamps

    logger.debug('Monitoreo: Limpieza de métricas completada')
  }

  /**
   * Iniciar limpieza automática
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 300000) // Cada 5 minutos
  }

  /**
   * Detener limpieza automática
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * Resetear métricas
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
        byStatus: new Map()
      },
      performance: {
        responseTimes: [],
        cacheHits: 0,
        cacheMisses: 0,
        dbQueries: 0,
        dbQueryTime: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        byEndpoint: new Map()
      },
      users: {
        active: new Set(),
        total: 0,
        newToday: 0
      }
    }
    this.startTime = Date.now()
    logger.info('Métricas de monitoreo reseteadas')
  }
}

// Instancia singleton del servicio de monitoreo
const monitoringService = new MonitoringService()

/**
 * Inicializar monitoreo con la aplicación Express
 * @param {Object} app - Aplicación Express
 */
function initMonitoring(app) {
  logger.info('📊 Inicializando sistema de monitoreo')

  // Middleware para registrar peticiones
  app.use((req, res, next) => {
    const startTime = Date.now()

    res.on('finish', () => {
      const responseTime = Date.now() - startTime
      monitoringService.recordRequest(req, res, responseTime)
    })

    next()
  })

  logger.info('✅ Sistema de monitoreo inicializado')
}

module.exports = monitoringService
module.exports.initMonitoring = initMonitoring
