import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import http from 'http'
import connectDB from './src/config/db.js'
import socketService from './src/services/socketService.js'
import redisService from './src/services/redisService.js'
import logger from './src/utils/logger.js'
import { config, validateConfig } from './src/utils/config.js'

const app = express()

// Configurar trust proxy para Nginx (requerido para rate limiting con X-Forwarded-For)
app.set('trust proxy', 1)

// Validar configuración al inicio
try {
  validateConfig()
  logger.info('✅ Configuración validada correctamente')
} catch (error) {
  logger.error('❌ Error de configuración:', error.message)
  process.exit(1)
}

// Configuración de monitoreo y optimización
import { initMonitoring } from './src/utils/monitoring.js'
import { errorMonitoringMiddleware, monitoringMiddleware } from './src/middlewares/monitoring.js'
import cache from './src/utils/cache.js'

// Request ID tracking
import requestId from './src/middlewares/requestId.js'

// Sanitización - Compatible con Express 5
import { sanitizeBody, sanitizeMongo } from './src/middlewares/sanitize.js'

// Health check endpoints
import healthRoutes from './src/routes/health.js'

// Rutas
import authRoutes from './src/routes/auth.js'
import userContentRoutes from './src/routes/userContent.js'
import postRoutes from './src/routes/post.js'
import userRoutes from './src/routes/user.js'
import commentRoutes from './src/routes/comment.js'
import storyRoutes from './src/routes/story.js'
import reelRoutes from './src/routes/reel.js'
import notificationRoutes from './src/routes/notification.js'
import conversationRoutes from './src/routes/conversation.js'
import messageRoutes from './src/routes/message.js'
import analyticsRoutes from './src/routes/analytics.js'
import liveStreamRoutes from './src/routes/liveStream.js'
import cstvRoutes from './src/routes/cstv.js'

// Compresión HTTP
app.use(compression())

// Configuración de seguridad
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        scriptSrc: ['\'self\''],
        imgSrc: ['\'self\'', 'data:', 'blob:'],
        mediaSrc: ['\'self\'', 'data:', 'blob:'],
        connectSrc: ['\'self\''],
        fontSrc: ['\'self\'', 'https:', 'data:'],
        objectSrc: ['\'none\''],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
)

// Rate limiting - más permisivo en desarrollo
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.isDevelopment ? 1000 : config.rateLimitMaxRequests,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
    res.status(429).json({
      error:
        'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
    })
  }
})

// Aplicar rate limiting solo a rutas específicas, no a todo /api/
app.use('/api/auth', limiter)
app.use('/api/posts', limiter)
app.use('/api/users', limiter)
app.use('/api/comments', limiter)
app.use('/api/stories', limiter)
app.use('/api/reels', limiter)
app.use('/api/notifications', limiter)
app.use('/api/conversations', limiter)
app.use('/api/messages', limiter)
app.use('/api/live-streams', limiter)
app.use('/api/cstv', limiter)
// Rate limiting para rutas de contenido de usuario
app.use('/api/:username', limiter)

// Request ID tracking
app.use(requestId)

// Sanitización - Compatible con Express 5
app.use(sanitizeMongo)
app.use(sanitizeBody)

// Middlewares básicos
app.use(express.json())
// Configuración compatible con Express 5
app.use(
  express.urlencoded({
    extended: true,
    // Prevenir que modifique req.query en Express 5
    parameterLimit: 1000,
    limit: '10mb'
  })
)

// Cookie parser para CSRF
app.use(cookieParser())

// CORS para desarrollo local
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}))

// Middleware de monitoreo (sin Morgan - usamos Winston)
app.use(monitoringMiddleware)

// Conexión a la base de datos
connectDB()

// Redis eliminado para simplificar el desarrollo local

// Configurar Swagger en desarrollo (importación dinámica)
if (config.isDevelopment) {
  import('swagger-ui-express').then(swaggerUi => {
    import('./src/config/swagger.js').then(({ default: swaggerSpec }) => {
      /**
       * @swagger
       * /:
       *   get:
       *     summary: Redirigir a documentación de API
       *     responses:
       *       302:
       *         description: Redirige a /api-docs
       */
      app.get('/', (req, res) => {
        res.redirect('/api-docs')
      })

      app.use(
        '/api-docs',
        swaggerUi.default.serve,
        swaggerUi.default.setup(swaggerSpec, {
          customSiteTitle: 'CircleSfera API Docs',
          customCss: '.swagger-ui .topbar { display: none }'
        })
      )

      logger.info(
        `📚 Documentación API disponible en: http://localhost:${config.port}/api-docs`
      )
    })
  })
}

// Health check endpoints (sin rate limiting ni autenticación)
app.use('/api/health', healthRoutes)

// Servir imágenes de uploads
app.use('/uploads', express.static('uploads'))

// Rutas de la aplicación (orden importante: específicas primero)
app.use('/api/auth', authRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/users', userRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/reels', reelRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/live-streams', liveStreamRoutes)
app.use('/api/cstv', cstvRoutes)
// User content routes al final (captura /:username/*)
app.use('/api', userContentRoutes)

// Sentry error handler eliminado

// Middleware de manejo de errores global
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Loguear el error con formato correcto
  const errorInfo = {
    error: err.message,
    method: req.method,
    path: req.path,
    ip: req.ip
  }

  if (config.isDevelopment && err.stack) {
    errorInfo.stack = err.stack
  }

  logger.error('Error en request:', errorInfo)

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: Object.values(err.errors).map(e => e.message)
    })
  }

  // Errores de casting de Mongoose (IDs inválidos)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido proporcionado'
    })
  }

  // Errores de duplicados de MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return res.status(400).json({
      success: false,
      message: `El valor proporcionado para ${field} ya existe`
    })
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    })
  }

  // Error JWT expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado'
    })
  }

  // Error genérico del servidor
  res.status(err.status || 500).json({
    success: false,
    message: config.isDevelopment ? err.message : 'Error interno del servidor',
    ...(config.isDevelopment && { stack: err.stack })
  })
})

// Manejo de rutas no encontradas (compatible con Express 5)
app.use((req, res) => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.path}`)
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  })
})

// Crear servidor HTTP
const server = http.createServer(app)

// Inicializar WebSockets
socketService.initialize(server)

// Inicializar Sentry
initMonitoring(app)

// Configurar middleware de manejo de errores con monitoreo
app.use(errorMonitoringMiddleware)

// Inicializar caché en memoria
logger.info('✅ Caché en memoria inicializado correctamente')

// Cron jobs programados para mantenimiento
setInterval(() => {
  try {
    // Limpiar caché en memoria periódicamente
    cache.cleanup()
    logger.info('Tarea de limpieza programada ejecutada correctamente')
  } catch (error) {
    logger.error('Error en tarea de limpieza programada:', error)
  }
}, 24 * 60 * 60 * 1000) // Ejecutar cada 24 horas

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Cerrar servidor gracefully
  server.close(() => {
    process.exit(1)
  })
})

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error)
  // Cerrar servidor gracefully
  server.close(() => {
    process.exit(1)
  })
})

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor gracefully...')
  server.close(() => {
    logger.info('Servidor cerrado')
    process.exit(0)
  })
})

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB()
    logger.info('✅ MongoDB conectado')

    // Conectar a Redis para tokens y blacklist
    try {
      await redisService.connect()
      logger.info('✅ Redis conectado (blacklist de tokens + caché)')
    } catch (error) {
      logger.warn('⚠️ Redis no disponible, usando memoria (solo desarrollo)', error.message)
    }

    // Iniciar servidor
    server.listen(config.port, () => {
      logger.info('========================================')
      logger.info(`🚀 Servidor CircleSfera corriendo en puerto ${config.port}`)
      logger.info(`   📊 Ambiente: ${config.nodeEnv}`)
      logger.info(`   🔗 Health check: http://localhost:${config.port}/api/health`)
      logger.info(`   🔌 WebSockets habilitados en ws://localhost:${config.port}`)
      logger.info(`   📝 Nivel de logging: ${config.logLevel}`)
      logger.info('========================================')
      logger.info('✅ Índices de base de datos ya definidos en schemas')
    })
  } catch (error) {
    logger.error('❌ Error al iniciar el servidor:', error)
    process.exit(1)
  }
}

// Iniciar servidor
startServer()
