import express from 'express'
import { auth as protect } from '../middlewares/auth.js'
import { requireAdmin, requireAdminPermission } from '../middlewares/adminAuth.js'
import { validate } from '../middlewares/validate.js'
import {
  getRealTimeDashboard,
  getUserAnalytics,
  getContentAnalytics,
  getEngagementAnalytics,
  getGeographicAnalytics,
  getPlatformAnalytics,
  getPeriodComparison,
  getCustomMetrics
} from '../controllers/advancedAnalyticsController.js'
import { z } from 'zod'

const router = express.Router()

// Todas las rutas requieren autenticación y permisos de administrador
router.use(protect)
router.use(requireAdminPermission('view_analytics'))

// Esquemas de validación
const timeRangeSchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d', '90d']).default('24h')
})

const userAnalyticsSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d']).default('30d'),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  groupBy: z.enum(['daily', 'weekly', 'monthly']).default('daily')
})

const contentAnalyticsSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d']).default('30d'),
  contentType: z.enum(['post', 'reel', 'story']).optional(),
  sortBy: z.enum(['engagement', 'likes', 'comments', 'views']).default('engagement')
})

const engagementAnalyticsSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d']).default('30d'),
  groupBy: z.enum(['daily', 'weekly', 'monthly']).default('daily')
})

const geographicAnalyticsSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d']).default('30d'),
  country: z.string().optional(),
  region: z.string().optional()
})

const platformAnalyticsSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d']).default('30d')
})

const periodComparisonSchema = z.object({
  metricType: z.string().min(1),
  currentPeriod: z.object({
    start: z.coerce.date(),
    end: z.coerce.date()
  }),
  previousPeriod: z.object({
    start: z.coerce.date(),
    end: z.coerce.date()
  })
})

const customMetricsSchema = z.object({
  metrics: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum([
        'active_users',
        'new_users',
        'content_created',
        'engagement',
        'top_content',
        'geographic',
        'platform'
      ]),
      limit: z.number().int().min(1).max(100).optional()
    })
  ).min(1),
  timeRange: z.enum(['7d', '30d', '90d']).default('30d'),
  filters: z.object({}).optional(),
  groupBy: z.enum(['daily', 'weekly', 'monthly']).default('daily')
})

/**
 * @swagger
 * /api/admin/analytics/dashboard:
 *   get:
 *     summary: Obtener métricas del dashboard en tiempo real
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d, 90d]
 *           default: 24h
 *         description: Rango de tiempo para las métricas
 *     responses:
 *       200:
 *         description: Métricas del dashboard obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         activeUsers:
 *                           type: number
 *                         newUsers:
 *                           type: number
 *                         totalPosts:
 *                           type: number
 *                         totalReels:
 *                           type: number
 *                         totalStories:
 *                           type: number
 *                         totalReports:
 *                           type: number
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         likes:
 *                           type: number
 *                         comments:
 *                           type: number
 *                         views:
 *                           type: number
 *                     topContent:
 *                       type: array
 *                       items:
 *                         type: object
 *                     growth:
 *                       type: array
 *                       items:
 *                         type: object
 *                     geographic:
 *                       type: array
 *                       items:
 *                         type: object
 *                     platform:
 *                       type: array
 *                       items:
 *                         type: object
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                     timeRange:
 *                       type: string
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/dashboard', validate(timeRangeSchema), getRealTimeDashboard)

// Endpoint temporal para debugging
router.get('/dashboard-debug', validate(timeRangeSchema), async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query
    res.json({
      success: true,
      data: {
        message: 'Debug endpoint working',
        timeRange,
        timestamp: new Date().toISOString(),
        user: req.user?.id
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Debug endpoint error',
      error: error.message
    })
  }
})

/**
 * @swagger
 * /api/admin/analytics/users:
 *   get:
 *     summary: Obtener análisis de usuarios
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Rango de tiempo para el análisis
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: ID del usuario específico (opcional)
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Agrupación temporal
 *     responses:
 *       200:
 *         description: Análisis de usuarios obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/users', validate(userAnalyticsSchema), getUserAnalytics)

/**
 * @swagger
 * /api/admin/analytics/content:
 *   get:
 *     summary: Obtener análisis de contenido
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Rango de tiempo para el análisis
 *       - in: query
 *         name: contentType
 *         schema:
 *           type: string
 *           enum: [post, reel, story]
 *         description: Tipo de contenido a filtrar (opcional)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [engagement, likes, comments, views]
 *           default: engagement
 *         description: Criterio de ordenamiento
 *     responses:
 *       200:
 *         description: Análisis de contenido obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/content', validate(contentAnalyticsSchema), getContentAnalytics)

/**
 * @swagger
 * /api/admin/analytics/engagement:
 *   get:
 *     summary: Obtener análisis de engagement
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Rango de tiempo para el análisis
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Agrupación temporal
 *     responses:
 *       200:
 *         description: Análisis de engagement obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/engagement', validate(engagementAnalyticsSchema), getEngagementAnalytics)

/**
 * @swagger
 * /api/admin/analytics/geographic:
 *   get:
 *     summary: Obtener análisis geográfico
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Rango de tiempo para el análisis
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: País específico para filtrar (opcional)
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Región específica para filtrar (opcional)
 *     responses:
 *       200:
 *         description: Análisis geográfico obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/geographic', validate(geographicAnalyticsSchema), getGeographicAnalytics)

/**
 * @swagger
 * /api/admin/analytics/platform:
 *   get:
 *     summary: Obtener análisis de plataformas
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Rango de tiempo para el análisis
 *     responses:
 *       200:
 *         description: Análisis de plataformas obtenido exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/platform', validate(platformAnalyticsSchema), getPlatformAnalytics)

/**
 * @swagger
 * /api/admin/analytics/comparison:
 *   post:
 *     summary: Obtener comparación de períodos
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metricType
 *               - currentPeriod
 *               - previousPeriod
 *             properties:
 *               metricType:
 *                 type: string
 *                 description: Tipo de métrica a comparar
 *               currentPeriod:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                   end:
 *                     type: string
 *                     format: date-time
 *               previousPeriod:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                   end:
 *                     type: string
 *                     format: date-time
 *     responses:
 *       200:
 *         description: Comparación de períodos obtenida exitosamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.post('/comparison', validate(periodComparisonSchema), getPeriodComparison)

/**
 * @swagger
 * /api/admin/analytics/custom:
 *   post:
 *     summary: Obtener métricas personalizadas
 *     tags: [Admin - Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metrics
 *             properties:
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - type
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Nombre de la métrica
 *                     type:
 *                       type: string
 *                       enum: [active_users, new_users, content_created, engagement, top_content, geographic, platform]
 *                       description: Tipo de métrica
 *                     limit:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 100
 *                       description: Límite de resultados (opcional)
 *               timeRange:
 *                 type: string
 *                 enum: [7d, 30d, 90d]
 *                 default: 30d
 *                 description: Rango de tiempo
 *               filters:
 *                 type: object
 *                 description: Filtros adicionales (opcional)
 *               groupBy:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *                 default: daily
 *                 description: Agrupación temporal
 *     responses:
 *       200:
 *         description: Métricas personalizadas obtenidas exitosamente
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.post('/custom', validate(customMetricsSchema), getCustomMetrics)

export default router
