const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { config } = require('../utils/config');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {

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
    const decoded = jwt.verify(token, config.jwtSecret);

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

    if (config.isDevelopment) {
      logger.info('Auth middleware - Usuario autenticado:', {
        userId: user._id.toString(),
        username: user.username,
        email: user.email
      });
    }

    next();
  } catch (error) {
    if (config.isDevelopment) {
      logger.debug('Error en middleware de autenticación:', error.message);
    }

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
    const decoded = jwt.verify(token, config.jwtSecret);

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
