/**
 * 🚀 Performance Routes
 * ====================
 * Rutas para métricas y monitoreo de performance
 */

import express from 'express'
import { auth } from '../middlewares/auth.js'
import { requireAdminPermission } from '../middlewares/admin.js'
import performanceMonitor from '../middlewares/performanceMiddleware.js'
import cacheService from '../services/cacheService.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * @route   GET /api/performance/metrics
 * @desc    Obtener métricas de performance del sistema
 * @access  Admin
 */
router.get('/metrics', auth, requireAdminPermission('view_analytics'), async (req, res) => {
  try {
    const performanceMetrics = performanceMonitor.getMetrics()
    const cacheStats = cacheService.getStats()
    const healthCheck = performanceMonitor.healthCheck()

    res.json({
      success: true,
      data: {
        performance: performanceMetrics,
        cache: cacheStats,
        health: healthCheck,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    logger.error('Error getting performance metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas de performance'
    })
  }
})

/**
 * @route   POST /api/performance/report
 * @desc    Reportar métricas de performance del frontend
 * @access  Public (con rate limiting)
 */
router.post('/report', async (req, res) => {
  try {
    const { metrics, url, userAgent, timestamp } = req.body

    // Validar datos básicos
    if (!metrics || !url) {
      return res.status(400).json({
        success: false,
        message: 'Métricas y URL son requeridas'
      })
    }

    // Log de métricas de frontend
    logger.info('Frontend performance metrics', {
      url,
      userAgent,
      timestamp,
      metrics: {
        pageLoadTime: metrics.pageLoadTime,
        firstContentfulPaint: metrics.firstContentfulPaint,
        largestContentfulPaint: metrics.largestContentfulPaint,
        firstInputDelay: metrics.firstInputDelay,
        cumulativeLayoutShift: metrics.cumulativeLayoutShift,
        bundleSize: metrics.bundleSize
      }
    })

    // Aquí podrías guardar en base de datos para análisis histórico
    // await PerformanceMetrics.create({ ... })

    res.json({
      success: true,
      message: 'Métricas reportadas exitosamente'
    })
  } catch (error) {
    logger.error('Error reporting performance metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Error reportando métricas'
    })
  }
})

/**
 * @route   GET /api/performance/health
 * @desc    Health check de performance
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = performanceMonitor.healthCheck()

    const statusCode = health.status === 'healthy' ? 200 :
      health.status === 'warning' ? 200 : 503

    res.status(statusCode).json({
      success: health.status !== 'degraded',
      data: health
    })
  } catch (error) {
    logger.error('Error in performance health check:', error)
    res.status(503).json({
      success: false,
      message: 'Error en health check de performance'
    })
  }
})

/**
 * @route   POST /api/performance/reset
 * @desc    Resetear métricas de performance
 * @access  Admin
 */
router.post('/reset', auth, requireAdminPermission('manage_system'), async (req, res) => {
  try {
    performanceMonitor.resetMetrics()

    logger.info('Performance metrics reset by admin', {
      adminId: req.user.id,
      timestamp: new Date().toISOString()
    })

    res.json({
      success: true,
      message: 'Métricas de performance reseteadas'
    })
  } catch (error) {
    logger.error('Error resetting performance metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Error reseteando métricas'
    })
  }
})

/**
 * @route   GET /api/performance/cache/stats
 * @desc    Obtener estadísticas del cache
 * @access  Admin
 */
router.get('/cache/stats', auth, requireAdminPermission('view_analytics'), async (req, res) => {
  try {
    const stats = cacheService.getStats()

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Error getting cache stats:', error)
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas del cache'
    })
  }
})

/**
 * @route   POST /api/performance/cache/clear
 * @desc    Limpiar cache
 * @access  Admin
 */
router.post('/cache/clear', auth, requireAdminPermission('manage_system'), async (req, res) => {
  try {
    const { pattern } = req.body

    let result
    if (pattern) {
      result = await cacheService.delPattern(pattern)
    } else {
      await cacheService.invalidateAll()
      result = 'all'
    }

    logger.info('Cache cleared by admin', {
      adminId: req.user.id,
      pattern: pattern || 'all',
      result,
      timestamp: new Date().toISOString()
    })

    res.json({
      success: true,
      message: `Cache limpiado${pattern ? ` (patrón: ${pattern})` : ' (completo)'}`,
      data: { cleared: result }
    })
  } catch (error) {
    logger.error('Error clearing cache:', error)
    res.status(500).json({
      success: false,
      message: 'Error limpiando cache'
    })
  }
})

/**
 * @route   GET /api/performance/slow-queries
 * @desc    Obtener queries lentas detectadas
 * @access  Admin
 */
router.get('/slow-queries', auth, requireAdminPermission('view_analytics'), async (req, res) => {
  try {
    // En una implementación real, esto vendría de una base de datos
    // donde se almacenan las queries lentas
    const slowQueries = [] // Placeholder

    res.json({
      success: true,
      data: {
        slowQueries,
        count: slowQueries.length,
        threshold: '1000ms'
      }
    })
  } catch (error) {
    logger.error('Error getting slow queries:', error)
    res.status(500).json({
      success: false,
      message: 'Error obteniendo queries lentas'
    })
  }
})

export default router
