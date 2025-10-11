import express from 'express'
const router = express.Router()
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  refreshToken,
  checkUsernameAvailability
} from '../controllers/authController.js'
import { auth } from '../middlewares/auth.js'
import { uploadFields, handleUploadError } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema
} from '../schemas/userSchema.js'
import imageOptimizer from '../middlewares/imageOptimizer.js'
import { provideCsrfToken, refreshCsrfToken, clearCsrfCookie, csrfProtection } from '../middlewares/csrf.js'
import { rateLimitByUser } from '../middlewares/rateLimitByUser.js'

// Rutas públicas
// Proporcionar CSRF token inicial (para formularios que no requieren auth)
router.get('/csrf-token', provideCsrfToken)

// Registro y login (refrescar token CSRF después de autenticación exitosa)
router.post('/register', validate(registerSchema), register, refreshCsrfToken)
router.post('/login', rateLimitByUser('login', { enforceInDev: true }), validate(loginSchema), login, refreshCsrfToken)
router.get('/check-username/:username', checkUsernameAvailability)

// Rutas protegidas (con protección CSRF)
router.get('/profile', auth, getProfile)
router.put(
  '/profile',
  auth,
  csrfProtection(),
  uploadFields,
  imageOptimizer,
  validate(updateProfileSchema),
  updateProfile,
  handleUploadError
)
router.put('/change-password', auth, csrfProtection(), rateLimitByUser('changePassword', { enforceInDev: true }), validate(changePasswordSchema), changePassword)
router.post('/logout', auth, csrfProtection(), logout, clearCsrfCookie)
// Ruta para refrescar token (NO protegida - usa refresh token en el body)
router.post('/refresh-token', refreshToken)

export default router
