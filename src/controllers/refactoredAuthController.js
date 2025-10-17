/**
 * 🔐 REFACTORED AUTH CONTROLLER
 * =============================
 * Controlador de autenticación refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import User from '../models/User.js'
import PasswordReset from '../models/PasswordReset.js'
import { config } from '../utils/config.js'
import logger from '../utils/logger.js'
import tokenService from '../services/tokenService.js'
import emailService from '../services/emailService.js'
import cacheService from '../services/cacheService.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class AuthController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para registro
  static registerValidations = [
    body('username')
      .isLength({ min: 3, max: 20 })
      .withMessage('El nombre de usuario debe tener entre 3 y 20 caracteres')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Debe proporcionar un email válido'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('La contraseña debe contener al menos una minúscula, una mayúscula y un número'),
    body('fullName')
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre completo debe tener entre 2 y 50 caracteres')
      .trim()
  ]

  // Validaciones específicas para login
  static loginValidations = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Debe proporcionar un email válido'),
    body('password')
      .notEmpty()
      .withMessage('La contraseña es requerida')
  ]

  // Validaciones para reset password
  static resetPasswordValidations = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Debe proporcionar un email válido')
  ]

  // Validaciones para change password
  static changePasswordValidations = [
    body('currentPassword')
      .notEmpty()
      .withMessage('La contraseña actual es requerida'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('La nueva contraseña debe contener al menos una minúscula, una mayúscula y un número')
  ]

  /**
   * Registro de usuario
   */
  async register(req, res) {
    try {
      // Usar validación del BaseController
      const validationError = this.handleValidation(req, res)
      if (validationError) return validationError

      const { username, email, password, fullName } = req.body

      // Verificar disponibilidad del username
      const isUsernameAvailable = await User.isUsernameAvailable(username)
      if (!isUsernameAvailable) {
        return AuthController.error(res, 'Este nombre de usuario ya está en uso o está bloqueado', 400)
      }

      // Verificar si el email ya existe
      const existingEmail = await User.findOne({ email: email.toLowerCase() })
      if (existingEmail) {
        return AuthController.error(res, 'Este email ya está registrado', 400)
      }

      // Crear nuevo usuario
      const user = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        fullName: fullName.trim()
      })

      await user.save()

      // Generar tokens
      const accessToken = tokenService.generateAccessToken(user._id)
      const refreshToken = tokenService.generateRefreshToken(user._id)

      // Cachear refresh token
      await cacheService.set(`refresh_token:${user._id}`, refreshToken, 7 * 24 * 60 * 60) // 7 días

      logger.info('Usuario registrado exitosamente', { userId: user._id, username })

      return AuthController.success(res, {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken
      }, 'Usuario registrado exitosamente', 201)

    } catch (error) {
      logger.error('Error en registro:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Login de usuario
   */
  async login(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) return validationError

      const { email, password } = req.body

      // Buscar usuario por email
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
      if (!user) {
        return AuthController.error(res, 'Credenciales inválidas', 401)
      }

      // Verificar contraseña
      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        return AuthController.error(res, 'Credenciales inválidas', 401)
      }

      // Generar tokens
      const accessToken = tokenService.generateAccessToken(user._id)
      const refreshToken = tokenService.generateRefreshToken(user._id)

      // Cachear refresh token
      await cacheService.set(`refresh_token:${user._id}`, refreshToken, 7 * 24 * 60 * 60)

      logger.info('Usuario logueado exitosamente', { userId: user._id })

      return AuthController.success(res, {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken
      }, 'Login exitoso')

    } catch (error) {
      logger.error('Error en login:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Logout de usuario
   */
  async logout(req, res) {
    try {
      const userId = req.user.id

      // Invalidar refresh token en cache
      await cacheService.del(`refresh_token:${userId}`)

      // Agregar token de acceso a blacklist
      const token = req.header('Authorization')?.replace('Bearer ', '')
      if (token) {
        await tokenService.addToBlacklist(token)
      }

      logger.info('Usuario deslogueado exitosamente', { userId })

      return AuthController.success(res, null, 'Logout exitoso')

    } catch (error) {
      logger.error('Error en logout:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        return AuthController.error(res, 'Refresh token requerido', 400)
      }

      // Verificar refresh token en cache
      const userId = await tokenService.verifyRefreshToken(refreshToken)
      const cachedToken = await cacheService.get(`refresh_token:${userId}`)

      if (!cachedToken || cachedToken !== refreshToken) {
        return AuthController.error(res, 'Refresh token inválido', 401)
      }

      // Generar nuevo access token
      const newAccessToken = tokenService.generateAccessToken(userId)

      logger.info('Token refrescado exitosamente', { userId })

      return AuthController.success(res, {
        accessToken: newAccessToken
      }, 'Token refrescado exitosamente')

    } catch (error) {
      logger.error('Error refrescando token:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Solicitar reset de contraseña
   */
  async forgotPassword(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) return validationError

      const { email } = req.body

      const user = await User.findOne({ email: email.toLowerCase() })
      if (!user) {
        // Por seguridad, no revelamos si el email existe o no
        return AuthController.success(res, null, 'Si el email existe, recibirás instrucciones para resetear tu contraseña')
      }

      // Generar token de reset
      const resetToken = await PasswordReset.generateResetToken(user._id)

      // Enviar email
      await emailService.sendPasswordResetEmail(user.email, resetToken)

      logger.info('Email de reset enviado', { userId: user._id, email })

      return AuthController.success(res, null, 'Si el email existe, recibirás instrucciones para resetear tu contraseña')

    } catch (error) {
      logger.error('Error en forgot password:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Reset de contraseña
   */
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body

      if (!token || !newPassword) {
        return AuthController.error(res, 'Token y nueva contraseña son requeridos', 400)
      }

      // Verificar token
      const passwordReset = await PasswordReset.findOne({
        token,
        expiresAt: { $gt: new Date() }
      })

      if (!passwordReset) {
        return AuthController.error(res, 'Token inválido o expirado', 400)
      }

      // Actualizar contraseña del usuario
      const user = await User.findById(passwordReset.userId)
      if (!user) {
        return AuthController.error(res, 'Usuario no encontrado', 404)
      }

      user.password = newPassword
      await user.save()

      // Eliminar token usado
      await passwordReset.deleteOne()

      // Invalidar todos los refresh tokens del usuario
      await cacheService.del(`refresh_token:${user._id}`)

      logger.info('Contraseña reseteada exitosamente', { userId: user._id })

      return AuthController.success(res, null, 'Contraseña actualizada exitosamente')

    } catch (error) {
      logger.error('Error en reset password:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Cambiar contraseña (usuario autenticado)
   */
  async changePassword(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) return validationError

      const { currentPassword, newPassword } = req.body
      const userId = req.user.id

      // Obtener usuario con contraseña
      const user = await User.findById(userId).select('+password')
      if (!user) {
        return AuthController.error(res, 'Usuario no encontrado', 404)
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword)
      if (!isCurrentPasswordValid) {
        return AuthController.error(res, 'Contraseña actual incorrecta', 400)
      }

      // Actualizar contraseña
      user.password = newPassword
      await user.save()

      // Invalidar todos los refresh tokens del usuario
      await cacheService.del(`refresh_token:${userId}`)

      logger.info('Contraseña cambiada exitosamente', { userId })

      return AuthController.success(res, null, 'Contraseña actualizada exitosamente')

    } catch (error) {
      logger.error('Error cambiando contraseña:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Obtener perfil del usuario actual
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.id

      const user = await User.findById(userId)
      if (!user) {
        return AuthController.error(res, 'Usuario no encontrado', 404)
      }

      return AuthController.success(res, {
        user: this.sanitizeUser(user)
      }, 'Perfil obtenido exitosamente')

    } catch (error) {
      logger.error('Error obteniendo perfil:', error)
      return AuthController.handleError(res, error)
    }
  }

  /**
   * Actualizar perfil del usuario
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id
      const updates = req.body

      // Campos permitidos para actualización
      const allowedFields = ['fullName', 'bio', 'website', 'location']
      const filteredUpdates = {}

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field]?.trim() || ''
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        filteredUpdates,
        { new: true, runValidators: true }
      )

      if (!user) {
        return AuthController.error(res, 'Usuario no encontrado', 404)
      }

      logger.info('Perfil actualizado exitosamente', { userId })

      return AuthController.success(res, {
        user: this.sanitizeUser(user)
      }, 'Perfil actualizado exitosamente')

    } catch (error) {
      logger.error('Error actualizando perfil:', error)
      return AuthController.handleError(res, error)
    }
  }
}

export const authController = new AuthController()

// Exportar las validaciones para uso en rutas
export {
  AuthController
}
