const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Log solo para requests específicos para evitar spam
    const shouldLog = process.env.NODE_ENV === 'development' &&
                     (req.path.includes('/posts') || req.path.includes('/users') || req.path.includes('/stories'));

    if (shouldLog) {
      console.log('🔐 Auth middleware - Ruta:', req.path, 'Método:', req.method);
    }

    // Obtener token del header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido',
      });
    }

    // Verificar formato del token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido. Use: Bearer <token>',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
      });
    }

    // Verificar JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }

    // Verificar que el usuario existe y está activo
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada',
      });
    }

    // Agregar usuario a la request
    req.user = user;
    req.userId = user._id;

    // Solo log en desarrollo y limitado para evitar spam
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
      console.log('Auth middleware - Usuario autenticado:', user.username, 'ID:', user._id);
    }

    // Log específico para stories para debugging
    if (process.env.NODE_ENV === 'development' && req.path.includes('/stories')) {
      console.log('🔐 Auth middleware - Stories - Usuario:', user.username, 'ID:', user._id);
    }

    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
      });
    }

    // Si es un error de JWT_SECRET no configurado
    if (error.message && error.message.includes('secretOrPrivateKey')) {
      return res.status(500).json({
        success: false,
        message: 'Error de configuración del servidor',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Middleware opcional para rutas que pueden ser públicas o privadas
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded && decoded.id) {
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
      }
    }

    next();
  } catch (error) {
    // Si hay error en el token, continuar sin autenticación
    next();
  }
};

module.exports = { auth, optionalAuth };
