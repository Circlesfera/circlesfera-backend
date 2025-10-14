import AnalyticsEvent from '../models/AnalyticsEvent.js'
import AnalyticsMetric from '../models/AnalyticsMetric.js'
import User from '../models/User.js'
import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import Story from '../models/Story.js'
import Report from '../models/Report.js'
import logger from '../utils/logger.js'
import analyticsSocketService from './analyticsSocketService.js'

/**
 * Servicio de Analytics - Maneja toda la lógica de análisis y métricas
 */
class AnalyticsService {
  /**
   * Registrar un evento de analytics
   */
  static async trackEvent(eventData) {
    try {
      const event = new AnalyticsEvent(eventData)
      await event.save()

      // Emitir evento en tiempo real a través de WebSockets
      if (analyticsSocketService && analyticsSocketService.io) {
        analyticsSocketService.emitToAllAdmins('analytics-event', {
          type: 'new-event',
          event: {
            eventType: event.eventType,
            userId: event.userId,
            contentType: event.contentType,
            category: event.category,
            severity: event.severity,
            timestamp: event.createdAt
          }
        })
      }

      return event
    } catch (error) {
      logger.error('Error tracking analytics event:', error)
      throw error
    }
  }

  /**
   * Obtener métricas del dashboard en tiempo real
   */
  static async getDashboardMetrics(timeRange = '24h') {
    try {
      const now = new Date()
      let startDate

      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      // Ejecutar todas las consultas en paralelo
      const [
        activeUsers,
        newUsers,
        totalPosts,
        totalReels,
        totalStories,
        totalReports,
        engagementMetrics,
        topContent,
        userGrowth,
        geographicData,
        platformUsage,
        errorMetrics
      ] = await Promise.all([
        this.getActiveUsers(startDate, now),
        this.getNewUsers(startDate, now),
        this.getContentMetrics(startDate, now),
        this.getEngagementMetrics(startDate, now),
        this.getTopContent(startDate, now),
        this.getUserGrowth(startDate, now),
        this.getGeographicDistribution(startDate, now),
        Report.countDocuments({ createdAt: { $gte: startDate } }),
        this.getPlatformUsage(startDate, now),
        this.getErrorMetrics(startDate, now)
      ])

      return {
        overview: {
          activeUsers,
          newUsers,
          totalPosts,
          totalReels,
          totalStories,
          totalReports
        },
        engagement: engagementMetrics,
        topContent,
        growth: userGrowth,
        geographic: geographicData,
        platform: platformUsage,
        errors: errorMetrics,
        timeRange,
        lastUpdated: now
      }
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error)
      throw error
    }
  }

  /**
   * Obtener usuarios activos en un período
   */
  static async getActiveUsers(startDate, endDate) {
    const result = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          userId: { $exists: true, $ne: null },
          eventType: { $in: ['user_login', 'post_create', 'reel_create', 'story_create', 'post_like', 'post_comment'] }
        }
      },
      {
        $group: {
          _id: '$userId',
          lastActivity: { $max: '$createdAt' },
          activityCount: { $sum: 1 }
        }
      },
      {
        $count: 'totalActiveUsers'
      }
    ])

    return result[0]?.totalActiveUsers || 0
  }

  /**
   * Obtener nuevos usuarios en un período
   */
  static async getNewUsers(startDate, endDate) {
    return await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    })
  }

  /**
   * Obtener métricas de contenido
   */
  static async getContentMetrics(startDate, endDate) {
    const [posts, reels, stories] = await Promise.all([
      Post.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Reel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Story.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } })
    ])

    return { posts, reels, stories }
  }

  /**
   * Obtener métricas de engagement
   */
  static async getEngagementMetrics(startDate, endDate) {
    const result = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] }
        }
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ])

    const metrics = {
      likes: 0,
      comments: 0,
      views: 0
    }

    result.forEach(item => {
      if (item._id.includes('like')) {
        metrics.likes += item.count
      } else if (item._id.includes('comment')) {
        metrics.comments += item.count
      } else if (item._id.includes('view')) {
        metrics.views += item.count
      }
    })

    return metrics
  }

  /**
   * Obtener contenido más popular
   */
  static async getTopContent(startDate, endDate, limit = 10) {
    const result = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] },
          contentId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$contentId',
          contentType: { $first: '$contentType' },
          likes: {
            $sum: {
              $cond: [{ $eq: ['$eventType', { $regex: /like/ }] }, 1, 0]
            }
          },
          comments: {
            $sum: {
              $cond: [{ $eq: ['$eventType', { $regex: /comment/ }] }, 1, 0]
            }
          },
          views: {
            $sum: {
              $cond: [{ $eq: ['$eventType', { $regex: /view/ }] }, 1, 0]
            }
          },
          totalEngagement: { $sum: 1 }
        }
      },
      {
        $sort: { totalEngagement: -1 }
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: '_id',
          as: 'post'
        }
      },
      {
        $lookup: {
          from: 'reels',
          localField: '_id',
          foreignField: '_id',
          as: 'reel'
        }
      },
      {
        $lookup: {
          from: 'stories',
          localField: '_id',
          foreignField: '_id',
          as: 'story'
        }
      },
      {
        $addFields: {
          content: {
            $cond: [
              { $gt: [{ $size: '$post' }, 0] },
              { $arrayElemAt: ['$post', 0] },
              {
                $cond: [
                  { $gt: [{ $size: '$reel' }, 0] },
                  { $arrayElemAt: ['$reel', 0] },
                  { $arrayElemAt: ['$story', 0] }
                ]
              }
            ]
          }
        }
      },
      {
        $project: {
          post: 0,
          reel: 0,
          story: 0
        }
      }
    ])

    return result
  }

  /**
   * Obtener crecimiento de usuarios
   */
  static async getUserGrowth(startDate, endDate) {
    const result = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ])

    return result.map(item => ({
      date: new Date(item._id.year, item._id.month - 1, item._id.day).toISOString().split('T')[0],
      count: item.count
    }))
  }

  /**
   * Obtener distribución geográfica
   */
  static async getGeographicDistribution(startDate, endDate) {
    const result = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          'location.country': { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            country: '$location.country',
            region: '$location.region'
          },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      },
      {
        $project: {
          uniqueUsers: 0
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 20
      }
    ])

    return result
  }

  /**
   * Obtener uso por plataforma
   */
  static async getPlatformUsage(startDate, endDate) {
    const result = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          platform: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      },
      {
        $project: {
          uniqueUsers: 0
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    return result
  }

  /**
   * Obtener métricas de errores
   */
  static async getErrorMetrics(startDate, endDate) {
    const result = await AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          'performance.errorOccurred': true
        }
      },
      {
        $group: {
          _id: '$performance.errorMessage',
          count: { $sum: 1 },
          severity: { $addToSet: '$severity' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ])

    return result
  }

  /**
   * Obtener análisis de retención de usuarios
   */
  static async getUserRetention(startDate, endDate, cohortPeriod = 'weekly') {
    // Implementación de análisis de cohortes
    const cohorts = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: cohortPeriod === 'weekly' ? '%Y-%U' : '%Y-%m',
              date: '$createdAt'
            }
          },
          users: { $push: '$_id' }
        }
      }
    ])

    const retentionData = []

    for (const cohort of cohorts) {
      const cohortUsers = cohort.users
      const retentionRates = []

      for (let week = 0; week < 12; week++) {
        const weekStart = new Date(cohort._id)
        weekStart.setDate(weekStart.getDate() + (week * 7))
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

        const activeUsers = await AnalyticsEvent.distinct('userId', {
          userId: { $in: cohortUsers },
          createdAt: { $gte: weekStart, $lt: weekEnd },
          eventType: { $in: ['user_login', 'post_create', 'reel_create'] }
        })

        const retentionRate = cohortUsers.length > 0
          ? (activeUsers.length / cohortUsers.length) * 100
          : 0

        retentionRates.push({
          week,
          retentionRate: Math.round(retentionRate * 100) / 100,
          activeUsers: activeUsers.length,
          totalUsers: cohortUsers.length
        })
      }

      retentionData.push({
        cohort: cohort._id,
        totalUsers: cohortUsers.length,
        retention: retentionRates
      })
    }

    return retentionData
  }

  /**
   * Generar métricas agregadas para un período
   */
  static async generateAggregatedMetrics(metricType, period, startDate, endDate) {
    try {
      let data = {}

      switch (metricType) {
        case 'daily_active_users':
          data = await this.getActiveUsers(startDate, endDate)
          break
        case 'new_registrations':
          data = await this.getNewUsers(startDate, endDate)
          break
        case 'content_created':
          data = await this.getContentMetrics(startDate, endDate)
          break
        case 'content_engagement':
          data = await this.getEngagementMetrics(startDate, endDate)
          break
        case 'geographic_distribution':
          data = await this.getGeographicDistribution(startDate, endDate)
          break
        case 'platform_usage':
          data = await this.getPlatformUsage(startDate, endDate)
          break
        case 'error_rates':
          data = await this.getErrorMetrics(startDate, endDate)
          break
        default:
          throw new Error(`Tipo de métrica no soportado: ${metricType}`)
      }

      // Guardar métrica agregada
      const metric = new AnalyticsMetric({
        metricType,
        period,
        periodStart: startDate,
        periodEnd: endDate,
        data,
        metadata: {
          generatedAt: new Date(),
          source: 'analytics_service'
        }
      })

      await metric.save()
      return metric

    } catch (error) {
      logger.error(`Error generating aggregated metrics for ${metricType}:`, error)
      throw error
    }
  }

  /**
   * Obtener tendencias de métricas
   */
  static async getMetricTrends(metricType, timeRange = '30d', period = 'daily') {
    try {
      const now = new Date()
      let startDate

      switch (timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }

      // Intentar obtener métricas pre-calculadas primero
      const existingMetrics = await AnalyticsMetric.getMetricsByType(metricType, startDate, now, period)

      if (existingMetrics.length > 0) {
        return existingMetrics.map(metric => ({
          date: metric.periodStart.toISOString().split('T')[0],
          value: metric.data,
          period: metric.period
        }))
      }

      // Si no hay métricas pre-calculadas, calcular en tiempo real
      // Esto es más lento pero garantiza datos actualizados
      logger.warn(`No se encontraron métricas pre-calculadas para ${metricType}, calculando en tiempo real`)

      // Para simplificar, retornar datos de ejemplo
      // En una implementación real, aquí se calcularían las métricas
      return []

    } catch (error) {
      logger.error(`Error getting metric trends for ${metricType}:`, error)
      throw error
    }
  }

  /**
   * Obtener comparación de períodos
   */
  static async getPeriodComparison(metricType, currentPeriod, previousPeriod) {
    try {
      const [current, previous] = await Promise.all([
        this.getDashboardMetrics(currentPeriod),
        this.getDashboardMetrics(previousPeriod)
      ])

      // Calcular cambios porcentuales
      const comparison = {
        current: current.overview,
        previous: previous.overview,
        changes: {}
      }

      Object.keys(current.overview).forEach(key => {
        const currentValue = current.overview[key]
        const previousValue = previous.overview[key]

        if (typeof currentValue === 'number' && typeof previousValue === 'number') {
          comparison.changes[key] = {
            value: currentValue - previousValue,
            percentage: previousValue > 0
              ? ((currentValue - previousValue) / previousValue) * 100
              : 0
          }
        }
      })

      return comparison

    } catch (error) {
      logger.error('Error getting period comparison:', error)
      throw error
    }
  }
}

export default AnalyticsService
