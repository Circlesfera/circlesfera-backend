import asyncHandler from 'express-async-handler'
import AnalyticsService from '../services/analyticsService.js'
import AnalyticsEvent from '../models/AnalyticsEvent.js'
import AnalyticsMetric from '../models/AnalyticsMetric.js'
import { User } from '../models/User.js'
import { Post } from '../models/Post.js'
import { Reel } from '../models/Reel.js'
import { Report } from '../models/Report.js'
import logger from '../utils/logger.js'

/**
 * Obtener métricas del dashboard en tiempo real
 */
export const getRealTimeDashboard = asyncHandler(async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query

    const metrics = await AnalyticsService.getDashboardMetrics(timeRange)

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Error getting real-time dashboard metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas del dashboard'
    })
  }
})

/**
 * Obtener análisis de usuarios
 */
export const getUserAnalytics = asyncHandler(async (req, res) => {
  try {
    const { timeRange = '30d', userId, groupBy = 'daily' } = req.query

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

    let analytics

    if (userId) {
      // Análisis de usuario específico
      analytics = await AnalyticsEvent.getUserActivity(userId, startDate, now)
    } else {
      // Análisis general de usuarios
      const [
        userGrowth,
        activeUsers,
        newUsers,
        userRetention,
        topUsers,
        geographicDistribution
      ] = await Promise.all([
        AnalyticsService.getUserGrowth(startDate, now),
        AnalyticsService.getActiveUsers(startDate, now),
        AnalyticsService.getNewUsers(startDate, now),
        AnalyticsService.getUserRetention(startDate, now, groupBy),
        getTopActiveUsers(startDate, now),
        AnalyticsService.getGeographicDistribution(startDate, now)
      ])

      analytics = {
        growth: userGrowth,
        activeUsers,
        newUsers,
        retention: userRetention,
        topUsers,
        geographicDistribution
      }
    }

    res.json({
      success: true,
      data: analytics,
      timeRange,
      period: { startDate, endDate: now }
    })

  } catch (error) {
    logger.error('Error getting user analytics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener análisis de usuarios'
    })
  }
})

/**
 * Obtener análisis de contenido
 */
export const getContentAnalytics = asyncHandler(async (req, res) => {
  try {
    const { timeRange = '30d', contentType, sortBy = 'engagement' } = req.query

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

    const [
      contentMetrics,
      engagementMetrics,
      topContent,
      contentTrends,
      contentTypeDistribution
    ] = await Promise.all([
      AnalyticsService.getContentMetrics(startDate, now),
      AnalyticsService.getEngagementMetrics(startDate, now),
      AnalyticsService.getTopContent(startDate, now, 20),
      getContentTrends(startDate, now),
      getContentTypeDistribution(startDate, now)
    ])

    const analytics = {
      metrics: contentMetrics,
      engagement: engagementMetrics,
      topContent,
      trends: contentTrends,
      distribution: contentTypeDistribution
    }

    // Filtrar por tipo de contenido si se especifica
    if (contentType && ['post', 'reel', 'story'].includes(contentType)) {
      analytics.topContent = analytics.topContent.filter(item => item.contentType === contentType)
    }

    // Ordenar contenido según criterio especificado
    if (sortBy === 'likes') {
      analytics.topContent.sort((a, b) => b.likes - a.likes)
    } else if (sortBy === 'comments') {
      analytics.topContent.sort((a, b) => b.comments - a.comments)
    } else if (sortBy === 'views') {
      analytics.topContent.sort((a, b) => b.views - a.views)
    } else {
      analytics.topContent.sort((a, b) => b.totalEngagement - a.totalEngagement)
    }

    res.json({
      success: true,
      data: analytics,
      timeRange,
      period: { startDate, endDate: now }
    })

  } catch (error) {
    logger.error('Error getting content analytics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener análisis de contenido'
    })
  }
})

/**
 * Obtener análisis de engagement
 */
export const getEngagementAnalytics = asyncHandler(async (req, res) => {
  try {
    const { timeRange = '30d', groupBy = 'daily' } = req.query

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

    const [
      engagementMetrics,
      engagementTrends,
      topEngagingContent,
      engagementByContentType,
      engagementByTimeOfDay,
      engagementByDayOfWeek
    ] = await Promise.all([
      AnalyticsService.getEngagementMetrics(startDate, now),
      getEngagementTrends(startDate, now, groupBy),
      AnalyticsService.getTopContent(startDate, now, 10),
      getEngagementByContentType(startDate, now),
      getEngagementByTimeOfDay(startDate, now),
      getEngagementByDayOfWeek(startDate, now)
    ])

    // Calcular métricas de engagement
    const totalInteractions = engagementMetrics.likes + engagementMetrics.comments + engagementMetrics.views
    const avgEngagementPerUser = await getAverageEngagementPerUser(startDate, now)

    const analytics = {
      metrics: {
        ...engagementMetrics,
        totalInteractions,
        avgEngagementPerUser
      },
      trends: engagementTrends,
      topContent: topEngagingContent,
      byContentType: engagementByContentType,
      byTimeOfDay: engagementByTimeOfDay,
      byDayOfWeek: engagementByDayOfWeek
    }

    res.json({
      success: true,
      data: analytics,
      timeRange,
      period: { startDate, endDate: now }
    })

  } catch (error) {
    logger.error('Error getting engagement analytics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener análisis de engagement'
    })
  }
})

/**
 * Obtener análisis geográfico
 */
export const getGeographicAnalytics = asyncHandler(async (req, res) => {
  try {
    const { timeRange = '30d', country, region } = req.query

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

    const [
      geographicDistribution,
      geographicTrends,
      topCountries,
      topRegions,
      geographicEngagement
    ] = await Promise.all([
      AnalyticsService.getGeographicDistribution(startDate, now),
      getGeographicTrends(startDate, now),
      getTopCountries(startDate, now),
      getTopRegions(startDate, now),
      getGeographicEngagement(startDate, now)
    ])

    const analytics = {
      distribution: geographicDistribution,
      trends: geographicTrends,
      topCountries,
      topRegions,
      engagement: geographicEngagement
    }

    // Filtrar por país o región si se especifica
    if (country) {
      analytics.distribution = analytics.distribution.filter(item =>
        item._id.country.toLowerCase() === country.toLowerCase()
      )
    }

    if (region) {
      analytics.distribution = analytics.distribution.filter(item =>
        item._id.region?.toLowerCase() === region.toLowerCase()
      )
    }

    res.json({
      success: true,
      data: analytics,
      timeRange,
      period: { startDate, endDate: now }
    })

  } catch (error) {
    logger.error('Error getting geographic analytics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener análisis geográfico'
    })
  }
})

/**
 * Obtener análisis de plataformas
 */
export const getPlatformAnalytics = asyncHandler(async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query

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

    const [
      platformUsage,
      platformTrends,
      platformEngagement,
      platformRetention
    ] = await Promise.all([
      AnalyticsService.getPlatformUsage(startDate, now),
      getPlatformTrends(startDate, now),
      getPlatformEngagement(startDate, now),
      getPlatformRetention(startDate, now)
    ])

    const analytics = {
      usage: platformUsage,
      trends: platformTrends,
      engagement: platformEngagement,
      retention: platformRetention
    }

    res.json({
      success: true,
      data: analytics,
      timeRange,
      period: { startDate, endDate: now }
    })

  } catch (error) {
    logger.error('Error getting platform analytics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener análisis de plataformas'
    })
  }
})

/**
 * Obtener comparación de períodos
 */
export const getPeriodComparison = asyncHandler(async (req, res) => {
  try {
    const { metricType, currentPeriod, previousPeriod } = req.body

    if (!metricType || !currentPeriod || !previousPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren metricType, currentPeriod y previousPeriod'
      })
    }

    const comparison = await AnalyticsService.getPeriodComparison(
      metricType,
      currentPeriod,
      previousPeriod
    )

    res.json({
      success: true,
      data: comparison,
      metricType
    })

  } catch (error) {
    logger.error('Error getting period comparison:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener comparación de períodos'
    })
  }
})

/**
 * Obtener métricas personalizadas
 */
export const getCustomMetrics = asyncHandler(async (req, res) => {
  try {
    const {
      metrics = [],
      timeRange = '30d',
      filters = {},
      groupBy = 'daily'
    } = req.body

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de métricas'
      })
    }

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

    const results = {}

    // Ejecutar métricas en paralelo
    const metricPromises = metrics.map(async (metric) => {
      try {
        let data

        switch (metric.type) {
          case 'active_users':
            data = await AnalyticsService.getActiveUsers(startDate, now)
            break
          case 'new_users':
            data = await AnalyticsService.getNewUsers(startDate, now)
            break
          case 'content_created':
            data = await AnalyticsService.getContentMetrics(startDate, now)
            break
          case 'engagement':
            data = await AnalyticsService.getEngagementMetrics(startDate, now)
            break
          case 'top_content':
            data = await AnalyticsService.getTopContent(startDate, now, metric.limit || 10)
            break
          case 'geographic':
            data = await AnalyticsService.getGeographicDistribution(startDate, now)
            break
          case 'platform':
            data = await AnalyticsService.getPlatformUsage(startDate, now)
            break
          default:
            data = null
        }

        return { metric: metric.name, data, error: null }
      } catch (error) {
        logger.error(`Error calculating metric ${metric.name}:`, error)
        return { metric: metric.name, data: null, error: error.message }
      }
    })

    const metricResults = await Promise.all(metricPromises)

    metricResults.forEach(result => {
      results[result.metric] = {
        data: result.data,
        error: result.error,
        timestamp: new Date().toISOString()
      }
    })

    res.json({
      success: true,
      data: results,
      timeRange,
      period: { startDate, endDate: now }
    })

  } catch (error) {
    logger.error('Error getting custom metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas personalizadas'
    })
  }
})

// Funciones auxiliares

async function getTopActiveUsers(startDate, endDate, limit = 10) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        userId: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$userId',
        activityCount: { $sum: 1 },
        lastActivity: { $max: '$createdAt' },
        eventTypes: { $addToSet: '$eventType' }
      }
    },
    {
      $sort: { activityCount: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        userId: '$_id',
        username: '$user.username',
        fullName: '$user.fullName',
        avatar: '$user.avatar',
        activityCount: 1,
        lastActivity: 1,
        eventTypes: 1
      }
    }
  ])
}

async function getContentTrends(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_create', 'reel_create', 'story_create'] }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          contentType: '$contentType'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ])
}

async function getContentTypeDistribution(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_create', 'reel_create', 'story_create'] }
      }
    },
    {
      $group: {
        _id: '$contentType',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ])
}

async function getEngagementTrends(startDate, endDate, groupBy = 'daily') {
  const format = groupBy === 'daily' ? '%Y-%m-%d' :
    groupBy === 'weekly' ? '%Y-%U' : '%Y-%m'

  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format, date: '$createdAt' } },
          eventType: '$eventType'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ])
}

async function getEngagementByContentType(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] },
        contentType: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$contentType',
        likes: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventType', regex: /like/ } }, 1, 0]
          }
        },
        comments: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventType', regex: /comment/ } }, 1, 0]
          }
        },
        views: {
          $sum: {
            $cond: [{ $regexMatch: { input: '$eventType', regex: /view/ } }, 1, 0]
          }
        },
        total: { $sum: 1 }
      }
    },
    {
      $sort: { total: -1 }
    }
  ])
}

async function getEngagementByTimeOfDay(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] }
      }
    },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ])
}

async function getEngagementByDayOfWeek(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] }
      }
    },
    {
      $group: {
        _id: { $dayOfWeek: '$createdAt' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ])
}

async function getAverageEngagementPerUser(startDate, endDate) {
  const result = await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] },
        userId: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$userId',
        engagementCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        avgEngagement: { $avg: '$engagementCount' },
        totalUsers: { $sum: 1 }
      }
    }
  ])

  return result[0]?.avgEngagement || 0
}

async function getGeographicTrends(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        'location.country': { $exists: true }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          country: '$location.country'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ])
}

async function getTopCountries(startDate, endDate, limit = 10) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        'location.country': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$location.country',
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
      $limit: limit
    }
  ])
}

async function getTopRegions(startDate, endDate, limit = 10) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        'location.region': { $exists: true }
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
      $limit: limit
    }
  ])
}

async function getGeographicEngagement(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        'location.country': { $exists: true },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] }
      }
    },
    {
      $group: {
        _id: '$location.country',
        engagementCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' },
        avgEngagementPerUser: {
          $divide: ['$engagementCount', { $size: '$uniqueUsers' }]
        }
      }
    },
    {
      $project: {
        uniqueUsers: 0
      }
    },
    {
      $sort: { engagementCount: -1 }
    }
  ])
}

async function getPlatformTrends(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        platform: { $exists: true }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          platform: '$platform'
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ])
}

async function getPlatformEngagement(startDate, endDate) {
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        platform: { $exists: true },
        eventType: { $in: ['post_like', 'post_comment', 'reel_like', 'reel_comment', 'story_view'] }
      }
    },
    {
      $group: {
        _id: '$platform',
        engagementCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' },
        avgEngagementPerUser: {
          $divide: ['$engagementCount', { $size: '$uniqueUsers' }]
        }
      }
    },
    {
      $project: {
        uniqueUsers: 0
      }
    },
    {
      $sort: { engagementCount: -1 }
    }
  ])
}

async function getPlatformRetention(startDate, endDate) {
  // Implementación simplificada de retención por plataforma
  return await AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        platform: { $exists: true },
        eventType: 'user_login'
      }
    },
    {
      $group: {
        _id: '$platform',
        uniqueUsers: { $addToSet: '$userId' },
        totalLogins: { $sum: 1 }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' },
        avgLoginsPerUser: {
          $divide: ['$totalLogins', { $size: '$uniqueUsers' }]
        }
      }
    },
    {
      $project: {
        uniqueUsers: 0
      }
    },
    {
      $sort: { uniqueUserCount: -1 }
    }
  ])
}
