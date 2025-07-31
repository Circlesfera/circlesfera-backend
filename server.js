require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');

const app = express();

// Configuración de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      scriptSrc: ["'self'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Configuración de CORS mejorada
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://circlesfera.vercel.app',
      'https://circlesfera.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging mejorado
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Conexión a la base de datos
connectDB();

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido'
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Este valor ya existe en la base de datos'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

// Rutas
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/posts', require('./src/routes/post'));
app.use('/api/users', require('./src/routes/user'));
app.use('/api/comments', require('./src/routes/comment'));
app.use('/api/stories', require('./src/routes/story'));
app.use('/api/notifications', require('./src/routes/notification'));
app.use('/api/conversations', require('./src/routes/conversation'));
app.use('/api/messages', require('./src/routes/message'));

// Servir imágenes de uploads
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CircleSfera API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

const PORT = process.env.PORT || 5001;

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor CircleSfera corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
