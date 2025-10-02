require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const http = require('http');
const connectDB = require('./src/config/db');
const socketService = require('./src/services/socketService');
const logger = require('./src/utils/logger');
const { config, validateConfig } = require('./src/utils/config');

const app = express();

// Validar configuración al inicio
try {
  validateConfig();
  logger.info('✅ Configuración validada correctamente');
} catch (error) {
  logger.error('❌ Error de configuración:', error.message);
  process.exit(1);
}

// Inicializar Sentry para monitoring (solo en producción)
const { initSentry } = require('./src/config/sentry');
const sentry = initSentry(app);

// Request handlers de Sentry (deben ir antes de otras rutas)
if (sentry) {
  app.use(sentry.Handlers.requestHandler());
  app.use(sentry.Handlers.tracingHandler());
}

// Compresión HTTP
app.use(compression());

// Configuración de seguridad
app.use(helmet({
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
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting - más permisivo en desarrollo
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.isDevelopment ? 1000 : config.rateLimitMaxRequests,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
    });
  },
});

// Aplicar rate limiting solo a rutas específicas, no a todo /api/
app.use('/api/auth', limiter);
app.use('/api/posts', limiter);
app.use('/api/users', limiter);
app.use('/api/comments', limiter);
app.use('/api/stories', limiter);
app.use('/api/reels', limiter);
app.use('/api/notifications', limiter);
app.use('/api/conversations', limiter);
app.use('/api/messages', limiter);

// Request ID tracking
const requestId = require('./src/middlewares/requestId');
app.use(requestId);

// Middleware de debugging temporal para identificar el problema con req.query
app.use((req, res, next) => {
  // Solo para peticiones OPTIONS que están causando problemas
  if (req.method === 'OPTIONS' && req.path === '/api/notifications/unread/count') {
    logger.info('Debugging OPTIONS request:', {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
    });
  }
  next();
});

// Sanitización
const { sanitizeMongo, sanitizeBody } = require('./src/middlewares/sanitize');
app.use(sanitizeMongo);
app.use(sanitizeBody);

// Middlewares básicos
app.use(express.json());
// Configuración compatible con Express 5
app.use(express.urlencoded({ 
  extended: true,
  // Prevenir que modifique req.query en Express 5
  parameterLimit: 1000,
  limit: '10mb'
}));

// CORS configurado para permitir el frontend
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
}));

// Logging HTTP con Morgan solo en desarrollo
if (config.isDevelopment) {
  app.use(morgan('dev', {
    skip: (req, res) => req.method === 'OPTIONS', // Saltar peticiones OPTIONS para evitar conflictos
  }));
} else {
  // En producción, logging mínimo
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400 || req.method === 'OPTIONS',
  }));
}

// Conexión a la base de datos
connectDB();

// Inicializar Redis (opcional)
const { initRedis } = require('./src/utils/cache');
initRedis().catch(err => {
  logger.warn('Redis no disponible, continuando sin cache:', err.message);
});

// Swagger Documentation
if (config.isDevelopment) {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./src/config/swagger');

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
    res.redirect('/api-docs');
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'CircleSfera API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  logger.info(`📚 Documentación API disponible en: http://localhost:${config.port}/api-docs`);
}

// Health check endpoints (sin rate limiting ni autenticación)
app.use('/api/health', require('./src/routes/health'));

// Servir imágenes de uploads
app.use('/uploads', express.static('uploads'));

// Rutas
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/posts', require('./src/routes/post'));
app.use('/api/users', require('./src/routes/user'));
app.use('/api/comments', require('./src/routes/comment'));
app.use('/api/stories', require('./src/routes/story'));
app.use('/api/reels', require('./src/routes/reel'));
app.use('/api/notifications', require('./src/routes/notification'));
app.use('/api/conversations', require('./src/routes/conversation'));
app.use('/api/messages', require('./src/routes/message'));

// Error handler de Sentry (debe ir ANTES del error handler global)
if (sentry) {
  app.use(sentry.Handlers.errorHandler());
}

// Middleware de manejo de errores global
app.use((err, req, res, _next) => {
  // Loguear el error con formato correcto
  const errorInfo = {
    error: err.message,
    method: req.method,
    path: req.path,
    ip: req.ip,
  };
  
  if (config.isDevelopment && err.stack) {
    errorInfo.stack = err.stack;
  }
  
  logger.error('Error en request:', errorInfo);

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: Object.values(err.errors).map(e => e.message),
    });
  }

  // Errores de casting de Mongoose (IDs inválidos)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido proporcionado',
    });
  }

  // Errores de duplicados de MongoDB
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `El valor proporcionado para ${field} ya existe`,
    });
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    });
  }

  // Error JWT expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
    });
  }

  // Error genérico del servidor
  res.status(err.status || 500).json({
    success: false,
    message: config.isDevelopment ? err.message : 'Error interno del servidor',
    ...(config.isDevelopment && { stack: err.stack }),
  });
});

// Manejo de rutas no encontradas (compatible con Express 5)
app.use((req, res) => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar WebSockets
socketService.initialize(server);

// Configurar cron jobs
const setupCronJobs = require('./src/utils/cronJobs');
setupCronJobs();

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Cerrar servidor gracefully
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Cerrar servidor gracefully
  server.close(() => {
    process.exit(1);
  });
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando servidor gracefully...');
  server.close(() => {
    logger.info('Servidor cerrado');
    process.exit(0);
  });
});

server.listen(config.port, () => {
  logger.info(`🚀 Servidor CircleSfera corriendo en puerto ${config.port}`);
  logger.info(`📊 Ambiente: ${config.nodeEnv}`);
  logger.info(`🔗 Health check: http://localhost:${config.port}/api/health`);
  logger.info(`🔌 WebSockets habilitados en ws://localhost:${config.port}`);
  logger.info(`📝 Nivel de logging: ${config.logLevel}`);
});
