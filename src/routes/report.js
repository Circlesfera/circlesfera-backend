import express from 'express'
const router = express.Router()
import { auth } from '../middlewares/auth.js'
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

// Middleware para verificar que el usuario es admin/moderador
const checkModerator = (req, res, next) => {
  // TODO: Implementar verificación de rol de moderador
  // Por ahora, todos los usuarios autenticados pueden ver reportes (cambiar en producción)
  if (!req.userId) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para acceder a esta función'
    })
  }
  next()
}

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

// Rutas de moderación (requieren permisos especiales)
// Obtener todos los reportes
router.get(
  '/',
  auth,
  checkModerator,
  getReports
)

// Obtener estadísticas de reportes
router.get(
  '/stats',
  auth,
  checkModerator,
  getReportStats
)

// Obtener un reporte específico
router.get(
  '/:reportId',
  auth,
  checkModerator,
  getReportById
)

// Actualizar estado de un reporte
router.put(
  '/:reportId/status',
  auth,
  csrfProtection(),
  checkModerator,
  validate(updateReportStatusSchema),
  updateReportStatus
)

export default router

