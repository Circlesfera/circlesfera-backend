import asyncHandler from 'express-async-handler'
import User from '../models/User.js'
import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import Story from '../models/Story.js'
import Report from '../models/Report.js'
import Comment from '../models/Comment.js'
import Message from '../models/Message.js'
import Notification from '../models/Notification.js'
import logger from '../utils/logger.js'

/**
 * Obtener lista de usuarios para administración
 */
export const getAdminUsers = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query

    // Construir filtros
    const filters = {}

    // Filtro por búsqueda
    if (search) {
      filters.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ]
    }

    // Filtro por rol
    if (role) {
      filters.role = role
    }

    // Filtro por estado
    if (status) {
      switch (status) {
        case 'active':
          filters.isActive = true
          filters.isBanned = false
          break
        case 'banned':
          filters.isBanned = true
          break
        case 'suspended':
          filters.isActive = false
          break
      }
    }

    // Construir ordenamiento
    const sort = {}
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1

    // Calcular paginación
    const skip = (parseInt(page) - 1) * parseInt(limit)

    // Obtener usuarios con agregación para estadísticas
    const users = await User.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'user',
          as: 'posts'
        }
      },
      {
        $lookup: {
          from: 'reports',
          localField: '_id',
          foreignField: 'reportedUser',
          as: 'reportsReceived'
        }
      },
      {
        $addFields: {
          postsCount: { $size: '$posts' },
          reportsCount: { $size: '$reportsReceived' },
          violationsCount: { $size: { $filter: { input: '$reportsReceived', cond: { $eq: ['$$this.status', 'resolved'] } } } }
        }
      },
      {
        $project: {
          _id: 1,
          username: 1,
          email: 1,
          avatar: 1,
          fullName: 1,
          bio: 1,
          role: 1,
          isVerified: 1,
          isActive: 1,
          isBanned: 1,
          banReason: 1,
          banExpiresAt: 1,
          createdAt: 1,
          lastLoginAt: 1,
          followersCount: 1,
          followingCount: 1,
          postsCount: 1,
          reportsCount: 1,
          violationsCount: 1
        }
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ])

    // Obtener total para paginación
    const total = await User.countDocuments(filters)

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    })

  } catch (error) {
    logger.error('Error en getAdminUsers:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    })
  }
})

/**
 * Obtener detalles de un usuario específico para administración
 */
export const getAdminUserDetails = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId).select('-password')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Obtener estadísticas adicionales
    const [
      postsCount,
      reelsCount,
      storiesCount,
      commentsCount,
      reportsReceived,
      reportsMade,
      followersCount,
      followingCount
    ] = await Promise.all([
      Post.countDocuments({ user: userId }),
      Reel.countDocuments({ user: userId }),
      Story.countDocuments({ user: userId }),
      Comment.countDocuments({ user: userId }),
      Report.countDocuments({ reportedUser: userId }),
      Report.countDocuments({ reporter: userId }),
      User.countDocuments({ following: userId }),
      User.countDocuments({ followers: userId })
    ])

    const userDetails = {
      ...user.toObject(),
      stats: {
        postsCount,
        reelsCount,
        storiesCount,
        commentsCount,
        reportsReceived,
        reportsMade,
        followersCount,
        followingCount
      }
    }

    res.json({
      success: true,
      data: { user: userDetails }
    })

  } catch (error) {
    logger.error('Error en getAdminUserDetails:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles del usuario'
    })
  }
})

/**
 * Cambiar rol de usuario
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params
    const { role } = req.body
    const currentAdminId = req.user.id

    // Validar rol
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido'
      })
    }

    // Verificar que el usuario objetivo existe
    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar que no se está cambiando el rol del mismo usuario
    if (userId === currentAdminId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes cambiar tu propio rol'
      })
    }

    // Solo los super admins pueden asignar rol de admin
    if (role === 'admin' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los super administradores pueden asignar rol de administrador'
      })
    }

    // Actualizar rol
    targetUser.role = role
    await targetUser.save()

    logger.info(`Usuario ${req.user.username} cambió el rol de ${targetUser.username} a ${role}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: `Rol actualizado a ${role}`
    })

  } catch (error) {
    logger.error('Error en updateUserRole:', error)
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol del usuario'
    })
  }
})

/**
 * Banear usuario
 */
export const banUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params
    const { reason, duration } = req.body
    const currentAdminId = req.user.id

    // Verificar que el usuario objetivo existe
    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar que no se está baneando a sí mismo
    if (userId === currentAdminId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes banear tu propia cuenta'
      })
    }

    // Verificar que no se está baneando a otro admin (solo super admins pueden)
    if (targetUser.role === 'admin' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los super administradores pueden banear otros administradores'
      })
    }

    // Configurar ban
    targetUser.isBanned = true
    targetUser.banReason = reason
    targetUser.bannedBy = currentAdminId
    targetUser.bannedAt = new Date()

    // Si se especifica duración, calcular fecha de expiración
    if (duration && duration > 0) {
      targetUser.banExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
    }

    await targetUser.save()

    logger.warn(`Usuario ${req.user.username} baneó a ${targetUser.username}. Razón: ${reason}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: 'Usuario baneado exitosamente'
    })

  } catch (error) {
    logger.error('Error en banUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error al banear usuario'
    })
  }
})

/**
 * Desbanear usuario
 */
export const unbanUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (!targetUser.isBanned) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no está baneado'
      })
    }

    // Verificar permisos para desbanear admins
    if (targetUser.role === 'admin' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los super administradores pueden desbanear otros administradores'
      })
    }

    // Remover ban
    targetUser.isBanned = false
    targetUser.banReason = undefined
    targetUser.bannedBy = undefined
    targetUser.bannedAt = undefined
    targetUser.banExpiresAt = undefined
    targetUser.unbannedBy = req.user.id
    targetUser.unbannedAt = new Date()

    await targetUser.save()

    logger.info(`Usuario ${req.user.username} desbaneó a ${targetUser.username}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: 'Usuario desbaneado exitosamente'
    })

  } catch (error) {
    logger.error('Error en unbanUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error al desbanear usuario'
    })
  }
})

/**
 * Verificar usuario
 */
export const verifyUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (targetUser.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está verificado'
      })
    }

    targetUser.isVerified = true
    targetUser.verifiedBy = req.user.id
    targetUser.verifiedAt = new Date()

    await targetUser.save()

    logger.info(`Usuario ${req.user.username} verificó a ${targetUser.username}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: 'Usuario verificado exitosamente'
    })

  } catch (error) {
    logger.error('Error en verifyUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error al verificar usuario'
    })
  }
})

/**
 * Desverificar usuario
 */
export const unverifyUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (!targetUser.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no está verificado'
      })
    }

    targetUser.isVerified = false
    targetUser.verifiedBy = undefined
    targetUser.verifiedAt = undefined
    targetUser.unverifiedBy = req.user.id
    targetUser.unverifiedAt = new Date()

    await targetUser.save()

    logger.info(`Usuario ${req.user.username} desverificó a ${targetUser.username}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: 'Usuario desverificado exitosamente'
    })

  } catch (error) {
    logger.error('Error en unverifyUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error al desverificar usuario'
    })
  }
})

/**
 * Suspender usuario
 */
export const suspendUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params
    const { reason, duration } = req.body
    const currentAdminId = req.user.id

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar que no se está suspendiendo a sí mismo
    if (userId === currentAdminId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes suspender tu propia cuenta'
      })
    }

    // Verificar permisos para suspender admins
    if (targetUser.role === 'admin' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los super administradores pueden suspender otros administradores'
      })
    }

    if (!targetUser.isActive) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está suspendido'
      })
    }

    // Configurar suspensión
    targetUser.isActive = false
    targetUser.suspensionReason = reason
    targetUser.suspendedBy = currentAdminId
    targetUser.suspendedAt = new Date()

    // Si se especifica duración, calcular fecha de expiración
    if (duration && duration > 0) {
      targetUser.suspensionExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
    }

    await targetUser.save()

    logger.warn(`Usuario ${req.user.username} suspendió a ${targetUser.username}. Razón: ${reason}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: 'Usuario suspendido exitosamente'
    })

  } catch (error) {
    logger.error('Error en suspendUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error al suspender usuario'
    })
  }
})

/**
 * Desuspender usuario
 */
export const unsuspendUser = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    if (targetUser.isActive) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no está suspendido'
      })
    }

    // Verificar permisos para desuspender admins
    if (targetUser.role === 'admin' && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los super administradores pueden desuspender otros administradores'
      })
    }

    // Remover suspensión
    targetUser.isActive = true
    targetUser.suspensionReason = undefined
    targetUser.suspendedBy = undefined
    targetUser.suspendedAt = undefined
    targetUser.suspensionExpiresAt = undefined
    targetUser.unsuspendedBy = req.user.id
    targetUser.unsuspendedAt = new Date()

    await targetUser.save()

    logger.info(`Usuario ${req.user.username} desuspendió a ${targetUser.username}`)

    res.json({
      success: true,
      data: { user: targetUser },
      message: 'Usuario desuspendido exitosamente'
    })

  } catch (error) {
    logger.error('Error en unsuspendUser:', error)
    res.status(500).json({
      success: false,
      message: 'Error al desuspender usuario'
    })
  }
})

/**
 * Obtener actividad de usuario
 */
export const getUserActivity = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Obtener actividad reciente
    const [recentPosts, recentReports, recentComments] = await Promise.all([
      Post.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'username avatar'),
      Report.find({ reportedUser: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('reporter', 'username')
        .populate('reportedUser', 'username'),
      Comment.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'username avatar')
        .populate('post', 'caption')
    ])

    res.json({
      success: true,
      data: {
        recentPosts,
        recentReports,
        recentComments
      }
    })

  } catch (error) {
    logger.error('Error en getUserActivity:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener actividad del usuario'
    })
  }
})

/**
 * Obtener estadísticas generales del sistema
 */
export const getSystemStats = asyncHandler(async (req, res) => {
  try {
    const [
      totalUsers,
      totalPosts,
      totalReels,
      totalStories,
      totalComments,
      totalReports,
      activeUsers,
      bannedUsers,
      verifiedUsers,
      adminUsers,
      moderatorUsers,
      recentRegistrations,
      recentReports
    ] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments(),
      Reel.countDocuments(),
      Story.countDocuments(),
      Comment.countDocuments(),
      Report.countDocuments(),
      User.countDocuments({ isActive: true, isBanned: false }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'moderator' }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Report.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })
    ])

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        verified: verifiedUsers,
        admins: adminUsers,
        moderators: moderatorUsers
      },
      content: {
        posts: totalPosts,
        reels: totalReels,
        stories: totalStories,
        comments: totalComments
      },
      moderation: {
        totalReports,
        recentReports
      },
      growth: {
        recentRegistrations
      }
    }

    res.json({
      success: true,
      data: stats
    })

  } catch (error) {
    logger.error('Error en getSystemStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del sistema'
    })
  }
})
