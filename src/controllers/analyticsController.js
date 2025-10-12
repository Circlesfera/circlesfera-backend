import AnalyticsEvent from '../models/AnalyticsEvent.js'
import User from '../models/User.js'
import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import Story from '../models/Story.js'
import LiveStream from '../models/LiveStream.js'
import Report from '../models/Report.js'
import Message from '../models/Message.js'
import logger from '../utils/logger.js'

/**
 * @desc    Registrar evento de analytics
 * @route   POST /api/analytics/event
 * @access  Public
 */
export const trackEvent = async (req, res) => {
  try {
    const { event, category, action, label, value, metadata, sessionId } =
      req.body

    // Obtener información adicional del request
    const eventData = {
      event,
      category,
      action,
      label,
      value,
      metadata,
      sessionId,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      language: req.get('accept-language'),
      referrer: req.get('referer'),
      timestamp: new Date()
    }

    // Si el usuario está autenticado, agregar su ID
    if (req.user && req.user.id) {
      eventData.user = req.user.id
    }

    // Guardar evento
    try {
      await AnalyticsEvent.create(eventData)
    } catch (err) {
      logger.error('Error guardando evento de analytics:', err)
    }

    // Responder inmediatamente
    res.status(204).send()
  } catch (error) {
    logger.error('Error en trackEvent:', error)
    // No fallar el request del cliente
    res.status(204).send()
  }
}

/**
 * @desc    Obtener estadísticas de eventos
 * @route   GET /api/analytics/stats
 * @access  Private (Admin)
 */
export const getStats = async (req, res) => {
  try {
    const { startDate, endDate, event, category, userId } = req.query

    // Construir filtros
    const filters = {}

    if (startDate || endDate) {
      filters.timestamp = {}
      if (startDate) {
        filters.timestamp.$gte = new Date(startDate)
      }
      if (endDate) {
        filters.timestamp.$lte = new Date(endDate)
      }
    }

    if (event) {
      filters.event = event
    }

    if (category) {
      filters.category = category
    }

    if (userId) {
      filters.user = userId
    }

    // Obtener estadísticas
    const stats = await AnalyticsEvent.getStats(filters)

    // Contar total de eventos
    const totalEvents = await AnalyticsEvent.countDocuments(filters)

    res.json({
      success: true,
      stats,
      totalEvents,
      filters
    })
  } catch (error) {
    logger.error('Error en getStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

/**
 * @desc    Obtener eventos de un usuario
 * @route   GET /api/analytics/user/:userId
 * @access  Private
 */
export const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const events = await AnalyticsEvent.find({ user: userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await AnalyticsEvent.countDocuments({ user: userId })

    res.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getUserAnalytics:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

/**
 * @desc    Limpiar eventos antiguos
 * @route   DELETE /api/analytics/cleanup
 * @access  Private (Admin)
 */
export const cleanup = async (req, res) => {
  try {
    const daysOld = parseInt(req.query.days) || 90
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await AnalyticsEvent.deleteMany({
      timestamp: { $lt: cutoffDate }
    })

    logger.info(`Eliminados ${result.deletedCount} eventos de analytics`)

    res.json({
      success: true,
      message: `Eliminados ${result.deletedCount} eventos`,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    logger.error('Error en cleanup:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

/**
 * @desc    Obtener actividad reciente del sistema
 * @route   GET /api/analytics/recent-activity
 * @access  Private (Admin/Moderator)
 */
export const getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20

    // Obtener actividad reciente de diferentes modelos en paralelo
    const [
      recentReports,
      recentUsers,
      recentPosts,
      recentReels,
      recentLiveStreams
    ] = await Promise.all([
      // Reportes recientes
      Report.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('contentType reason status createdAt reportedBy')
        .populate('reportedBy', 'username avatar')
        .lean(),

      // Usuarios nuevos
      User.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('username avatar fullName createdAt')
        .lean(),

      // Posts recientes
      Post.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('caption createdAt user')
        .populate('user', 'username avatar')
        .lean(),

      // Reels recientes
      Reel.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('caption createdAt user')
        .populate('user', 'username avatar')
        .lean(),

      // Lives recientes
      LiveStream.find()
        .sort({ createdAt: -1 })
        .limit(3)
        .select('title status createdAt user')
        .populate('user', 'username avatar')
        .lean()
    ])

    // Combinar y formatear actividades
    const activities = []

    // Reportes
    recentReports.forEach(report => {
      activities.push({
        type: 'report',
        message: `Nuevo reporte: ${report.reason} en ${report.contentType}`,
        timestamp: report.createdAt,
        user: report.reportedBy?.username,
        relatedId: report._id,
        status: report.status,
        severity: report.reason === 'spam' ? 'low' : report.reason === 'harassment' ? 'high' : 'medium'
      })
    })

    // Usuarios nuevos
    recentUsers.forEach(user => {
      activities.push({
        type: 'user_join',
        message: `Nuevo usuario: ${user.username}`,
        timestamp: user.createdAt,
        user: user.username,
        relatedId: user._id,
        severity: 'info'
      })
    })

    // Posts
    recentPosts.forEach(post => {
      activities.push({
        type: 'content_post',
        message: `Nuevo post de ${post.user?.username}`,
        timestamp: post.createdAt,
        user: post.user?.username,
        relatedId: post._id,
        severity: 'info'
      })
    })

    // Reels
    recentReels.forEach(reel => {
      activities.push({
        type: 'content_reel',
        message: `Nuevo reel de ${reel.user?.username}`,
        timestamp: reel.createdAt,
        user: reel.user?.username,
        relatedId: reel._id,
        severity: 'info'
      })
    })

    // Lives
    recentLiveStreams.forEach(live => {
      const statusText = live.status === 'live' ? 'inició transmisión' : 'finalizó transmisión'
      activities.push({
        type: 'live_stream',
        message: `${live.user?.username} ${statusText}`,
        timestamp: live.createdAt,
        user: live.user?.username,
        relatedId: live._id,
        status: live.status,
        severity: 'info'
      })
    })

    // Ordenar por fecha (más reciente primero) y limitar
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    res.json({
      success: true,
      data: sortedActivities,
      total: sortedActivities.length
    })
  } catch (error) {
    logger.error('Error en getRecentActivity:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

/**
 * @desc    Obtener estadísticas generales del sistema (para dashboard admin)
 * @route   GET /api/analytics/dashboard
 * @access  Private (Admin/Moderator)
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Ejecutar todas las consultas en paralelo para mejor performance
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalReels,
      totalStories,
      totalReports,
      pendingReports,
      resolvedReports,
      rejectedReports,
      activeLiveStreams,
      totalMessages,
      usersLast24h,
      postsLast24h,
      reelsLast24h
    ] = await Promise.all([
      // Usuarios
      User.countDocuments({ isActive: true }),
      User.countDocuments({
        isActive: true,
        lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),

      // Contenido
      Post.countDocuments({ isDeleted: false }),
      Reel.countDocuments({ isDeleted: false }),
      Story.countDocuments({
        expiresAt: { $gt: new Date() }
      }),

      // Reportes
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'rejected' }),

      // Live y mensajes
      LiveStream.countDocuments({ status: 'live' }),
      Message.countDocuments(),

      // Crecimiento (últimas 24h)
      User.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      Post.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      Reel.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ])

    // Calcular tendencias
    const reportsTrend = pendingReports > 0
      ? Math.round((pendingReports / totalReports) * 100)
      : 0

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          new24h: usersLast24h,
          activePercentage: Math.round((activeUsers / totalUsers) * 100)
        },
        content: {
          posts: totalPosts,
          reels: totalReels,
          stories: totalStories,
          posts24h: postsLast24h,
          reels24h: reelsLast24h
        },
        reports: {
          total: totalReports,
          pending: pendingReports,
          resolved: resolvedReports,
          rejected: rejectedReports,
          underReview: totalReports - pendingReports - resolvedReports - rejectedReports,
          trend: reportsTrend
        },
        activity: {
          liveStreams: activeLiveStreams,
          totalMessages
        }
      }
    })
  } catch (error) {
    logger.error('Error en getDashboardStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
