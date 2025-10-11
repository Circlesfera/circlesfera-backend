import User from '../models/User.js'
import { config } from '../utils/config.js'
import logger from '../utils/logger.js'
import tokenService from '../services/tokenService.js'

const auth = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.header('Authorization')

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido'
      })
    }

    // Verificar formato del token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido. Use: Bearer <token>'
      })
    }

    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      })
    }

    // Verificar token con tokenService (incluye blacklist)
    const decoded = await tokenService.verifyToken(token)

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      })
    }

    // Verificar que sea un access token
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Tipo de token inválido. Use un access token'
      })
    }

    // Verificar si todos los tokens del usuario fueron invalidados
    if (decoded.iat) {
      const areInvalidated = await tokenService.areUserTokensInvalidated(decoded.userId, decoded.iat)
      if (areInvalidated) {
        return res.status(401).json({
          success: false,
          message: 'Sesión invalidada, por favor inicia sesión nuevamente'
        })
      }
    }

    // Verificar que el usuario existe y está activo
    const user = await User.findById(decoded.userId).select('-password')

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada'
      })
    }

    // Agregar usuario y token a la request
    req.user = user
    req.userId = user._id
    req.token = token // Guardar token para blacklist en logout

    if (config.isDevelopment) {
      logger.info('Auth middleware - Usuario autenticado:', {
        userId: user._id.toString(),
        username: user.username,
        email: user.email
      })
    }

    next()
  } catch (error) {
    if (config.isDevelopment) {
      logger.debug('Error en middleware de autenticación:', error.message)
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      })
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      })
    }

    // Si es un error de JWT_SECRET no configurado
    if (error.message && error.message.includes('secretOrPrivateKey')) {
      return res.status(500).json({
        success: false,
        message: 'Error de configuración del servidor'
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Middleware opcional para rutas que pueden ser públicas o privadas
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = await tokenService.verifyToken(token)

    if (decoded && decoded.userId && decoded.type === 'access') {
      // Verificar invalidación de tokens
      if (decoded.iat) {
        const areInvalidated = await tokenService.areUserTokensInvalidated(decoded.userId, decoded.iat)
        if (!areInvalidated) {
          const user = await User.findById(decoded.userId).select('-password')
          if (user && user.isActive) {
            req.user = user
            req.userId = user._id
            req.token = token
          }
        }
      }
    }

    next()
  } catch (error) {
    // Si hay error en el token, continuar sin autenticación
    logger.debug('Error en optionalAuth:', error.message)
    next()
  }
}

export { auth, optionalAuth }
