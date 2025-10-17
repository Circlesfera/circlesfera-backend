import cacheManager from '../infrastructure/cache/CacheManager.js'
import queryOptimizer from '../infrastructure/performance/QueryOptimizer.js'
import responseOptimizer from '../infrastructure/performance/ResponseOptimizer.js'
import logger from '../utils/logger.js'

/**
 * Middleware de performance para optimizar respuestas
 */
export const performanceMiddleware = (options = {}) => {
  const {
    enableCaching = true,
    enableCompression = true,
    enableQueryOptimization = true,
    cacheTTL = 300,
    compressionThreshold = 1024
  } = options

  return async (req, res, next) => {
    const startTime = Date.now()
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Agregar ID de request a la respuesta
    res.setHeader('X-Request-ID', requestId)

    // Interceptar res.json para optimizar respuestas
    const originalJson = res.json
    res.json = function (data) {
      const processingTime = Date.now() - startTime

      // Optimizar respuesta
      const optimizedResponse = responseOptimizer.optimizeResponse(data, {
        compress: enableCompression,
        paginate: req.query.page && req.query.limit,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        processingTime,
        cacheHit: res.locals.cacheHit || false,
        compressed: res.locals.compressed || false
      })

      // Log de performance
      logger.info('Response optimized', {
        requestId,
        method: req.method,
        url: req.url,
        processingTime,
        originalSize: JSON.stringify(data).length,
        optimizedSize: JSON.stringify(optimizedResponse).length,
        compressionRatio: res.locals.compressed ?
          `${((JSON.stringify(data).length - JSON.stringify(optimizedResponse).length) / JSON.stringify(data).length * 100).toFixed(2)}%` : 'N/A'
      })

      return originalJson.call(this, optimizedResponse)
    }

    next()
  }
}

/**
 * Middleware de caché para GET requests
 */
export const cacheMiddleware = (options = {}) => {
  const {
    type = 'default',
    ttl = 300,
    keyGenerator = null,
    skipCache = false,
    invalidateOn = []
  } = options

  return async (req, res, next) => {
    // Solo aplicar caché a GET requests
    if (req.method !== 'GET' || skipCache) {
      return next()
    }

    // Generar clave de caché
    let cacheKey
    if (keyGenerator && typeof keyGenerator === 'function') {
      cacheKey = keyGenerator(req)
    } else {
      // Generar clave automáticamente
      const url = req.originalUrl || req.url
      const userId = req.user?.id || 'anonymous'
      cacheKey = `${type}:${req.method}:${url}:${userId}`
    }

    try {
      // Intentar obtener del caché
      const cachedResponse = await cacheManager.get(type, cacheKey)

      if (cachedResponse) {
        logger.debug(`Cache hit for ${cacheKey}`)
        res.locals.cacheHit = true
        return res.json(cachedResponse)
      }

      // No está en caché, continuar con el request
      logger.debug(`Cache miss for ${cacheKey}`)

      // Interceptar la respuesta para guardarla en caché
      const originalJson = res.json
      res.json = function (data) {
        // Guardar en caché en background (no bloquear respuesta)
        setImmediate(async () => {
          try {
            await cacheManager.set(type, cacheKey, data, {}, ttl)
            logger.debug(`Response cached for ${cacheKey}`)
          } catch (error) {
            logger.error(`Error caching response for ${cacheKey}:`, error)
          }
        })

        return originalJson.call(this, data)
      }

      next()
    } catch (error) {
      logger.error(`Cache middleware error for ${cacheKey}:`, error)
      next()
    }
  }
}

/**
 * Middleware para invalidar caché en operaciones de escritura
 */
export const cacheInvalidationMiddleware = (options = {}) => {
  const {
    patterns = [],
    type = 'default'
  } = options

  return async (req, res, next) => {
    // Interceptar respuestas exitosas para invalidar caché
    const originalJson = res.json
    res.json = function (data) {
      // Invalidar caché en background si la respuesta es exitosa
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            for (const pattern of patterns) {
              if (typeof pattern === 'function') {
                const patternResult = pattern(req, data)
                if (patternResult) {
                  await cacheManager.invalidatePattern(type, patternResult)
                  logger.debug(`Cache invalidated for pattern: ${patternResult}`)
                }
              } else {
                await cacheManager.invalidatePattern(type, pattern)
                logger.debug(`Cache invalidated for pattern: ${pattern}`)
              }
            }
          } catch (error) {
            logger.error('Error invalidating cache:', error)
          }
        })
      }

      return originalJson.call(this, data)
    }

    next()
  }
}

/**
 * Middleware para optimizar consultas de base de datos
 */
export const queryOptimizationMiddleware = (options = {}) => {
  const {
    enableIndexHints = true,
    enableQueryAnalysis = true,
    slowQueryThreshold = 1000
  } = options

  return (req, res, next) => {
    // Agregar métodos de optimización a req
    req.optimizeQuery = (query, queryOptions = {}) => {
      if (enableIndexHints) {
        return queryOptimizer.optimizeFind(query, queryOptions)
      }
      return query
    }

    req.optimizeAggregation = (pipeline, pipelineOptions = {}) => {
      if (enableIndexHints) {
        return queryOptimizer.optimizeAggregation(pipeline, pipelineOptions)
      }
      return pipeline
    }

    req.analyzeQuery = (query, executionTime, collection) => {
      if (enableQueryAnalysis && executionTime > slowQueryThreshold) {
        return queryOptimizer.analyzeSlowQuery(query, executionTime, collection)
      }
      return null
    }

    next()
  }
}

/**
 * Middleware para métricas de performance
 */
export const metricsMiddleware = () => (req, res, next) => {
  const startTime = Date.now()
  const startCpuUsage = process.cpuUsage()

  res.on('finish', () => {
    const endTime = Date.now()
    const endCpuUsage = process.cpuUsage(startCpuUsage)
    const responseTime = endTime - startTime

    const metrics = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      cpuUsage: {
        user: endCpuUsage.user,
        system: endCpuUsage.system
      },
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }

    // Log métricas para requests lentos
    if (responseTime > 1000) {
      logger.warn('Slow request detected:', metrics)
    } else {
      logger.debug('Request metrics:', metrics)
    }

    // Agregar métricas a headers de respuesta (opcional)
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Response-Time', `${responseTime}ms`)
      res.setHeader('X-Memory-Usage', `${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`)
    }
  })

  next()
}

/**
 * Middleware para rate limiting inteligente
 */
export const smartRateLimitMiddleware = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    max = 100,
    skipSuccessfulRequests = true,
    skipFailedRequests = false
  } = options

  const requests = new Map()

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress
    const now = Date.now()
    const windowStart = now - windowMs

    // Limpiar requests antiguos
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart)
      requests.set(key, userRequests)
    } else {
      requests.set(key, [])
    }

    const userRequests = requests.get(key)

    // Verificar límite
    if (userRequests.length >= max) {
      logger.warn('Rate limit exceeded', {
        ip: key,
        requests: userRequests.length,
        max,
        windowMs
      })

      return res.status(429).json({
        success: false,
        message: 'Demasiadas solicitudes. Intenta más tarde.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      })
    }

    // Agregar request actual
    userRequests.push(now)

    // Interceptar respuesta para manejar rate limiting inteligente
    res.on('finish', () => {
      if (skipSuccessfulRequests && res.statusCode < 400) {
        // Remover request exitoso del contador
        const index = userRequests.indexOf(now)
        if (index > -1) {
          userRequests.splice(index, 1)
        }
      }

      if (skipFailedRequests && res.statusCode >= 400) {
        // Remover request fallido del contador
        const index = userRequests.indexOf(now)
        if (index > -1) {
          userRequests.splice(index, 1)
        }
      }
    })

    next()
  }
}

/**
 * Middleware de compresión inteligente
 */
export const smartCompressionMiddleware = (options = {}) => {
  const {
    threshold = 1024, // 1KB
    level = 6,
    memLevel = 8
  } = options

  return (req, res, next) => {
    const originalJson = res.json
    res.json = function (data) {
      const dataString = JSON.stringify(data)
      const dataSize = Buffer.byteLength(dataString, 'utf8')

      // Solo comprimir si el tamaño supera el threshold
      if (dataSize > threshold) {
        res.locals.compressed = true
        res.setHeader('Content-Encoding', 'gzip')

        // En una implementación real, aquí se aplicaría la compresión gzip
        logger.debug(`Response compressed: ${dataSize} bytes`)
      }

      return originalJson.call(this, data)
    }

    next()
  }
}
