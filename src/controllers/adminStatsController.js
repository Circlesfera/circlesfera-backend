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
 * Obtener estadísticas del dashboard de administración
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Estadísticas básicas del sistema
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
      moderatorUsers
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
      User.countDocuments({ role: 'moderator' })
    ])

    // Crecimiento reciente
    const [
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      newPostsToday,
      newPostsThisWeek,
      newReportsToday,
      newReportsThisWeek
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: last24Hours } }),
      User.countDocuments({ createdAt: { $gte: last7Days } }),
      User.countDocuments({ createdAt: { $gte: last30Days } }),
      Post.countDocuments({ createdAt: { $gte: last24Hours } }),
      Post.countDocuments({ createdAt: { $gte: last7Days } }),
      Report.countDocuments({ createdAt: { $gte: last24Hours } }),
      Report.countDocuments({ createdAt: { $gte: last7Days } })
    ])

    // Reportes por estado
    const [
      pendingReports,
      underReviewReports,
      resolvedReports,
      rejectedReports
    ] = await Promise.all([
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'under_review' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'rejected' })
    ])

    // Reportes por razón
    const reportsByReason = await Report.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])

    // Reportes por tipo de contenido
    const reportsByContentType = await Report.aggregate([
      {
        $group: {
          _id: '$contentType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])

    // Usuarios más activos (por posts)
    const mostActiveUsers = await User.aggregate([
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'user',
          as: 'posts'
        }
      },
      {
        $addFields: {
          postsCount: { $size: '$posts' }
        }
      },
      {
        $match: {
          postsCount: { $gt: 0 }
        }
      },
      {
        $sort: { postsCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          username: 1,
          avatar: 1,
          fullName: 1,
          postsCount: 1,
          followersCount: 1
        }
      }
    ])

    // Contenido más reportado
    const mostReportedContent = await Report.aggregate([
      {
        $group: {
          _id: {
            contentType: '$contentType',
            contentId: '$contentId'
          },
          reportCount: { $sum: 1 }
        }
      },
      {
        $sort: { reportCount: -1 }
      },
      {
        $limit: 10
      }
    ])

    // Estadísticas de actividad por día (últimos 7 días)
    const dailyActivity = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const startOfDay = new Date(date.setHours(0, 0, 0, 0))
        const endOfDay = new Date(date.setHours(23, 59, 59, 999))

        return Promise.all([
          User.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
          }),
          Post.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
          }),
          Report.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
          })
        ]).then(([users, posts, reports]) => ({
          date: startOfDay.toISOString().split('T')[0],
          users,
          posts,
          reports
        }))
      })
    )

    // Tiempo promedio de resolución de reportes
    const avgResolutionTime = await Report.aggregate([
      {
        $match: {
          status: 'resolved',
          resolvedAt: { $exists: true },
          createdAt: { $exists: true }
        }
      },
      {
        $addFields: {
          resolutionTimeHours: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convertir a horas
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgHours: { $avg: '$resolutionTimeHours' }
        }
      }
    ])

    const stats = {
      overview: {
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
        moderatorUsers
      },
      growth: {
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        newPostsToday,
        newPostsThisWeek,
        newReportsToday,
        newReportsThisWeek
      },
      reports: {
        byStatus: {
          pending: pendingReports,
          underReview: underReviewReports,
          resolved: resolvedReports,
          rejected: rejectedReports
        },
        byReason: reportsByReason,
        byContentType: reportsByContentType,
        averageResolutionTime: avgResolutionTime[0]?.avgHours
          ? `${Math.round(avgResolutionTime[0].avgHours)}h`
          : '0h'
      },
      analytics: {
        mostActiveUsers,
        mostReportedContent,
        dailyActivity: dailyActivity.reverse() // Ordenar cronológicamente
      }
    }

    res.json({
      success: true,
      data: stats
    })

  } catch (error) {
    logger.error('Error en getDashboardStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard'
    })
  }
})

/**
 * Obtener estadísticas de reportes
 */
export const getReportStats = asyncHandler(async (req, res) => {
  try {
    const [
      totalReports,
      pendingReports,
      underReviewReports,
      resolvedReports,
      rejectedReports
    ] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'under_review' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'rejected' })
    ])

    // Reportes por razón
    const byReason = await Report.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])

    // Reportes por tipo de contenido
    const byContentType = await Report.aggregate([
      {
        $group: {
          _id: '$contentType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])

    // Tiempo promedio de resolución
    const avgResolutionTime = await Report.aggregate([
      {
        $match: {
          status: 'resolved',
          resolvedAt: { $exists: true },
          createdAt: { $exists: true }
        }
      },
      {
        $addFields: {
          resolutionTimeHours: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgHours: { $avg: '$resolutionTimeHours' }
        }
      }
    ])

    const stats = {
      total: totalReports,
      byStatus: {
        pending: pendingReports,
        under_review: underReviewReports,
        resolved: resolvedReports,
        rejected: rejectedReports
      },
      byReason,
      byContentType,
      averageResolutionTime: avgResolutionTime[0]?.avgHours
        ? `${Math.round(avgResolutionTime[0].avgHours)}h`
        : '0h'
    }

    res.json({
      success: true,
      data: stats
    })

  } catch (error) {
    logger.error('Error en getReportStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de reportes'
    })
  }
})

/**
 * Obtener estadísticas de usuarios
 */
export const getUserStats = asyncHandler(async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      suspendedUsers,
      verifiedUsers,
      adminUsers,
      moderatorUsers,
      regularUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true, isBanned: false }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ isVerified: true }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'moderator' }),
      User.countDocuments({ role: 'user' })
    ])

    // Usuarios nuevos por mes (últimos 12 meses)
    const monthlyRegistrations = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

        return User.countDocuments({
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }).then(count => ({
          month: startOfMonth.toISOString().substring(0, 7),
          count
        }))
      })
    )

    // Usuarios más activos
    const mostActiveUsers = await User.aggregate([
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
          from: 'reels',
          localField: '_id',
          foreignField: 'user',
          as: 'reels'
        }
      },
      {
        $addFields: {
          totalContent: {
            $add: [{ $size: '$posts' }, { $size: '$reels' }]
          }
        }
      },
      {
        $match: {
          totalContent: { $gt: 0 }
        }
      },
      {
        $sort: { totalContent: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          username: 1,
          avatar: 1,
          fullName: 1,
          totalContent: 1,
          followersCount: 1,
          postsCount: { $size: '$posts' },
          reelsCount: { $size: '$reels' }
        }
      }
    ])

    const stats = {
      total: totalUsers,
      byStatus: {
        active: activeUsers,
        banned: bannedUsers,
        suspended: suspendedUsers
      },
      byRole: {
        admin: adminUsers,
        moderator: moderatorUsers,
        user: regularUsers
      },
      verified: verifiedUsers,
      monthlyRegistrations: monthlyRegistrations.reverse(),
      mostActiveUsers
    }

    res.json({
      success: true,
      data: stats
    })

  } catch (error) {
    logger.error('Error en getUserStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de usuarios'
    })
  }
})
