import express from 'express'
const router = express.Router()
import { body } from 'express-validator'
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
import imageOptimizer from '../middlewares/imageOptimizer.js'

// Validaciones
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      'El nombre de usuario solo puede contener letras, números y guiones bajos'
    ),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Por favor ingresa un email válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'La contraseña debe contener al menos una letra mayúscula, una minúscula y un número'
    ),
  body('fullName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('El nombre completo no puede exceder 50 caracteres')
]

const loginValidation = [
  body('email').notEmpty().withMessage('El email es requerido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
]

const updateProfileValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      'El nombre de usuario solo puede contener letras, números y guiones bajos'
    ),
  body('fullName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('El nombre completo no puede exceder 50 caracteres'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('La biografía no puede exceder 160 caracteres'),
  body('website')
    .optional()
    .if(body('website').notEmpty())
    .isURL()
    .withMessage('Por favor ingresa una URL válida'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La ubicación no puede exceder 100 caracteres'),
  body('phone')
    .optional()
    .if(body('phone').notEmpty())
    .matches(/^\+?[\d\s\-()]+$/u)
    .withMessage('Por favor ingresa un número de teléfono válido'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
    .withMessage('Género inválido'),
  body('birthDate')
    .optional()
    .if(body('birthDate').notEmpty())
    .isISO8601()
    .withMessage('Fecha de nacimiento inválida'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('El valor de privacidad debe ser true o false')
]

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'La contraseña debe contener al menos una letra mayúscula, una minúscula y un número'
    )
]

// Rutas públicas
router.post('/register', registerValidation, register)
router.post('/login', loginValidation, login)
router.get('/check-username/:username', checkUsernameAvailability)

// Rutas protegidas
router.get('/profile', auth, getProfile)
router.put(
  '/profile',
  auth,
  uploadFields,
  imageOptimizer,
  handleUploadError,
  updateProfileValidation,
  updateProfile
)
router.put('/change-password', auth, changePasswordValidation, changePassword)
router.post('/logout', auth, logout)
router.post('/refresh-token', auth, refreshToken)

export default router
