import AnalyticsEvent from '../models/AnalyticsEvent.js'
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
