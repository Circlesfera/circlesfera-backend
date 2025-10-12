import express from 'express'
const router = express.Router()
import { auth } from '../middlewares/auth.js'
import { checkRole } from '../middlewares/checkRole.js'
import { validate } from '../middlewares/validate.js'
import {
  createReportSchema,
  updateReportStatusSchema
} from '../schemas/reportSchema.js'
import {
  createReport,
  getReportById,
  getReports,
  getReportStats,
  updateReportStatus
} from '../controllers/reportController.js'
import { csrfProtection } from '../middlewares/csrf.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'

// Rutas públicas (con autenticación)
// Crear un reporte
router.post(
  '/',
  auth,
  csrfProtection(),
  rateLimitByUser('createReport'),
  validate(createReportSchema),
  createReport
)

// Rutas de moderación (requieren permisos de moderador o admin)
// Obtener todos los reportes
router.get(
  '/',
  auth,
  checkRole(['moderator', 'admin']),
  getReports
)

// Obtener estadísticas de reportes
router.get(
  '/stats',
  auth,
  checkRole(['moderator', 'admin']),
  getReportStats
)

// Obtener un reporte específico
router.get(
  '/:reportId',
  auth,
  checkRole(['moderator', 'admin']),
  getReportById
)

// Actualizar estado de un reporte
router.put(
  '/:reportId/status',
  auth,
  csrfProtection(),
  checkRole(['moderator', 'admin']),
  validate(updateReportStatusSchema),
  updateReportStatus
)

export default router

