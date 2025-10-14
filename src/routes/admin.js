import express from 'express'
import { auth as protect } from '../middlewares/auth.js'
import { requireAdmin, requireSuperAdmin, requireAdminPermission } from '../middlewares/adminAuth.js'
import { validate } from '../middlewares/validate.js'
import {
  getAdminUsers,
  getAdminUserDetails,
  updateUserRole,
  banUser,
  unbanUser,
  verifyUser,
  unverifyUser,
  suspendUser,
  unsuspendUser,
  getUserActivity,
  getSystemStats
} from '../controllers/adminController.js'
import {
  getDashboardStats,
  getReportStats,
  getUserStats
} from '../controllers/adminStatsController.js'
import { adminUserSchema, banUserSchema, suspendUserSchema } from '../schemas/adminSchema.js'

const router = express.Router()

// Todas las rutas requieren autenticación
router.use(protect)

// ========================================
// RUTAS DE USUARIOS - ADMINISTRACIÓN
// ========================================

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Obtener lista de usuarios para administración
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Usuarios por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda por username, email o nombre
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, moderator, admin]
 *         description: Filtrar por rol
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, banned, suspended]
 *         description: Filtrar por estado
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Campo para ordenar
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Orden de clasificación
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/users', requireAdminPermission('manage_users'), getAdminUsers)

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Obtener detalles de un usuario específico
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Detalles del usuario obtenidos exitosamente
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/users/:userId', requireAdminPermission('manage_users'), getAdminUserDetails)

/**
 * @swagger
 * /api/admin/users/{userId}/role:
 *   put:
 *     summary: Cambiar rol de usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, moderator, admin]
 *                 description: Nuevo rol del usuario
 *     responses:
 *       200:
 *         description: Rol actualizado exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.put('/users/:userId/role',
  requireAdminPermission('manage_roles'),
  validate(adminUserSchema),
  updateUserRole
)

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   post:
 *     summary: Banear usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Razón del ban
 *               duration:
 *                 type: integer
 *                 description: Duración en días (opcional, permanente si no se especifica)
 *     responses:
 *       200:
 *         description: Usuario baneado exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.post('/users/:userId/ban',
  requireAdminPermission('ban_users'),
  validate(banUserSchema),
  banUser
)

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   delete:
 *     summary: Desbanear usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario desbaneado exitosamente
 *       400:
 *         description: Usuario no está baneado
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.delete('/users/:userId/ban', requireAdminPermission('ban_users'), unbanUser)

/**
 * @swagger
 * /api/admin/users/{userId}/verify:
 *   post:
 *     summary: Verificar usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario verificado exitosamente
 *       400:
 *         description: Usuario ya está verificado
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.post('/users/:userId/verify', requireAdminPermission('verify_users'), verifyUser)

/**
 * @swagger
 * /api/admin/users/{userId}/verify:
 *   delete:
 *     summary: Desverificar usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario desverificado exitosamente
 *       400:
 *         description: Usuario no está verificado
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.delete('/users/:userId/verify', requireAdminPermission('verify_users'), unverifyUser)

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   post:
 *     summary: Suspender usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *               - duration
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Razón de la suspensión
 *               duration:
 *                 type: integer
 *                 description: Duración en días
 *     responses:
 *       200:
 *         description: Usuario suspendido exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.post('/users/:userId/suspend',
  requireAdminPermission('ban_users'),
  validate(suspendUserSchema),
  suspendUser
)

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   delete:
 *     summary: Desuspender usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario desuspendido exitosamente
 *       400:
 *         description: Usuario no está suspendido
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.delete('/users/:userId/suspend', requireAdminPermission('ban_users'), unsuspendUser)

/**
 * @swagger
 * /api/admin/users/{userId}/activity:
 *   get:
 *     summary: Obtener actividad de usuario
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Actividad del usuario obtenida exitosamente
 *       404:
 *         description: Usuario no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/users/:userId/activity', requireAdminPermission('manage_users'), getUserActivity)

// ========================================
// RUTAS DE ESTADÍSTICAS DEL SISTEMA
// ========================================

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Obtener estadísticas generales del sistema
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/stats', requireAdminPermission('view_analytics'), getSystemStats)

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Obtener estadísticas del dashboard de administración
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del dashboard obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/dashboard/stats', requireAdminPermission('view_analytics'), getDashboardStats)

/**
 * @swagger
 * /api/admin/stats/reports:
 *   get:
 *     summary: Obtener estadísticas de reportes
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de reportes obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/stats/reports', requireAdminPermission('view_analytics'), getReportStats)

/**
 * @swagger
 * /api/admin/stats/users:
 *   get:
 *     summary: Obtener estadísticas de usuarios
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de usuarios obtenidas exitosamente
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos de administrador
 */
router.get('/stats/users', requireAdminPermission('view_analytics'), getUserStats)

export default router
