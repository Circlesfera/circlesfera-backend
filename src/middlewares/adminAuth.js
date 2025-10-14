import asyncHandler from 'express-async-handler'
import { User } from '../models/User.js'

/**
 * Middleware para verificar que el usuario es administrador o moderador
 */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  // Verificar que el usuario esté autenticado
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acceso denegado. Token requerido.'
    })
  }

  // Obtener el usuario actualizado de la base de datos
  const user = await User.findById(req.user.id).select('role isActive isBanned')

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no encontrado.'
    })
  }

  // Verificar que el usuario esté activo y no baneado
  if (!user.isActive || user.isBanned) {
    return res.status(403).json({
      success: false,
      message: 'Cuenta desactivada o baneada.'
    })
  }

  // Verificar que tenga rol de administrador o moderador
  if (!['admin', 'moderator'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de administrador.'
    })
  }

  // Agregar información del rol al request
  req.userRole = user.role
  req.isAdmin = user.role === 'admin'
  req.isModerator = user.role === 'moderator'

  next()
})

/**
 * Middleware para verificar que el usuario es administrador (solo admin)
 */
export const requireSuperAdmin = asyncHandler(async (req, res, next) => {
  // Verificar que el usuario esté autenticado
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acceso denegado. Token requerido.'
    })
  }

  // Obtener el usuario actualizado de la base de datos
  const user = await User.findById(req.user.id).select('role isActive isBanned')

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no encontrado.'
    })
  }

  // Verificar que el usuario esté activo y no baneado
  if (!user.isActive || user.isBanned) {
    return res.status(403).json({
      success: false,
      message: 'Cuenta desactivada o baneada.'
    })
  }

  // Verificar que tenga rol de administrador
  if (user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren permisos de super administrador.'
    })
  }

  // Agregar información del rol al request
  req.userRole = user.role
  req.isAdmin = true

  next()
})

/**
 * Middleware para verificar permisos específicos de administración
 */
export const requireAdminPermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token requerido.'
      })
    }

    // Obtener el usuario actualizado de la base de datos
    const user = await User.findById(req.user.id).select('role isActive isBanned')

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado.'
      })
    }

    // Verificar que el usuario esté activo y no baneado
    if (!user.isActive || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada o baneada.'
      })
    }

    // Definir permisos por rol
    const permissions = {
      admin: [
        'manage_users',
        'manage_roles',
        'ban_users',
        'verify_users',
        'view_reports',
        'manage_reports',
        'view_analytics',
        'manage_system',
        'manage_content'
      ],
      moderator: [
        'view_reports',
        'manage_reports',
        'ban_users',
        'view_analytics'
      ]
    }

    // Verificar que el usuario tenga el permiso requerido
    if (!permissions[user.role] || !permissions[user.role].includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado. Se requiere permiso: ${permission}`
      })
    }

    // Agregar información del rol al request
    req.userRole = user.role
    req.isAdmin = user.role === 'admin'
    req.isModerator = user.role === 'moderator'

    next()
  })
}
