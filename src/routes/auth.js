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

// Rutas públicas
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.get('/check-username/:username', checkUsernameAvailability)

// Rutas protegidas
router.get('/profile', auth, getProfile)
router.put(
  '/profile',
  auth,
  uploadFields,
  imageOptimizer,
  validate(updateProfileSchema),
  updateProfile,
  handleUploadError
)
router.put('/change-password', auth, validate(changePasswordSchema), changePassword)
router.post('/logout', auth, logout)
router.post('/refresh-token', auth, refreshToken)

export default router
