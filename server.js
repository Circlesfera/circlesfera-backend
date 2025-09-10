require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const connectDB = require('./src/config/db');
const socketService = require('./src/services/socketService');

const app = express();

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

// Rate limiting más permisivo en desarrollo
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Mucho más permisivo en desarrollo
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar peticiones exitosas
  skipFailedRequests: false, // Contar peticiones fallidas
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

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configurado para permitir el frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Conexión a la base de datos
connectDB();

// Health check endpoint (sin rate limiting)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CircleSfera API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

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

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: Object.values(err.errors).map(e => e.message),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido',
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Este valor ya existe en la base de datos',
    });
  }

  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
});

// Manejo de rutas no encontradas (compatible con Express 5)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

const PORT = process.env.PORT || 5001;

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar WebSockets
socketService.initialize(server);

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor CircleSfera corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSockets habilitados en ws://localhost:${PORT}`);
});
