import User from '../models/User.js'
import logger from '../utils/logger.js'

/**
 * Middleware para verificar que el usuario tiene uno de los roles requeridos
 * @param {Array<String>} roles - Array de roles permitidos ['admin', 'moderator', 'user']
 * @returns {Function} Middleware function
 */
export const checkRole = (roles) => async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado (debe venir del middleware auth)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      })
    }

    // Obtener usuario de la base de datos para tener el rol actualizado
    const user = await User.findById(req.user.id).select('role username')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar si el usuario tiene uno de los roles requeridos
    if (!roles.includes(user.role)) {
      logger.warn(`Acceso denegado: Usuario ${user.username} (${user.role}) intentó acceder a ruta que requiere roles: ${roles.join(', ')}`)

      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      })
    }

    // Adjuntar rol al request para uso posterior
    req.userRole = user.role

    next()
  } catch (error) {
    logger.error('Error en middleware checkRole:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export default checkRole

