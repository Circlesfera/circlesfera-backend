import User from '../models/User.js'
import PasswordReset from '../models/PasswordReset.js'
import { validationResult } from 'express-validator'
import { config } from '../utils/config.js'
import logger from '../utils/logger.js'
import tokenService from '../services/tokenService.js'
import emailService from '../services/emailService.js'

// Respuesta de usuario sin información sensible
const sanitizeUser = (user) => {
  const userObj = user.toObject()
  delete userObj.password
  delete userObj.blockedUsers
  delete userObj.preferences
  return userObj
}

export const register = async (req, res) => {
  try {
    // Validar errores de validación
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { username, email, password, fullName } = req.body

    // Verificar si el username está disponible
    const isUsernameAvailable = await User.isUsernameAvailable(username)
    if (!isUsernameAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Este nombre de usuario ya está en uso o está bloqueado'
      })
    }

    // Verificar si el email ya existe
    const existingEmail = await User.findOne({ email: email.toLowerCase() })
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Este email ya está registrado'
      })
    }

    // Crear nuevo usuario
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      fullName: fullName || username
    })

    await user.save()

    // Bloquear el username para este usuario
    await User.blockUsername(user._id, username)

    // Generar par de tokens (access + refresh)
    const tokens = tokenService.generateTokenPair(user._id)

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token: tokens.accessToken, // Enviar como 'token' para compatibilidad con frontend
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: sanitizeUser(user)
    })

  } catch (error) {
    logger.error('Error en registro:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: config.isDevelopment ? error.message : undefined
    })
  }
}

export const login = async (req, res) => {
  try {
    // Validar errores de validación
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { email, password } = req.body

    // Buscar usuario por email o username
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email.toLowerCase() }
      ]
    }).select('+password')

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      })
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta ha sido desactivada'
      })
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      })
    }

    // Actualizar último acceso
    await user.updateLastSeen()

    // Generar par de tokens (access + refresh)
    const tokens = tokenService.generateTokenPair(user._id)

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token: tokens.accessToken, // Enviar como 'token' para compatibilidad con frontend
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: sanitizeUser(user)
    })

  } catch (error) {
    logger.error('Error en login:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: config.isDevelopment ? error.message : undefined
    })
  }
}

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      user: sanitizeUser(user)
    })

  } catch (error) {
    logger.error('Error obteniendo perfil:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      logger.error('Errores de validación en updateProfile:', {
        errors: errors.array(),
        body: req.body,
        userId: req.user?.id
      })
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const {
      username,
      fullName,
      bio,
      website,
      location,
      phone,
      gender,
      birthDate,
      isPrivate
    } = req.body

    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Manejar archivo de avatar si se subió
    if (req.files && req.files.avatar && req.files.avatar.length > 0) {
      const avatarFile = req.files.avatar[0]

      // Obtener la URL base del servidor desde config (o fallback a request)
      const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`
      const avatarUrl = `${baseUrl}/uploads/${avatarFile.filename}`
      user.avatar = avatarUrl

      logger.info(`Avatar actualizado para usuario ${user.username}: ${avatarUrl}`)
    }

    // Si se está cambiando el username
    if (username && username !== user.username) {
      // Verificar si el nuevo username está disponible
      const isAvailable = await User.isUsernameAvailable(username)

      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Este nombre de usuario ya está en uso o está bloqueado'
        })
      }

      // Desbloquear el username anterior
      await User.unblockUsername(user._id, user.username)

      // Bloquear el nuevo username
      await User.blockUsername(user._id, username)

      // Actualizar el username del usuario
      user.username = username.toLowerCase()
    }

    // Actualizar otros campos permitidos
    if (fullName !== undefined) { user.fullName = fullName }
    if (bio !== undefined) { user.bio = bio }
    if (website !== undefined) { user.website = website }
    if (location !== undefined) { user.location = location }
    if (phone !== undefined) { user.phone = phone }
    if (gender !== undefined) { user.gender = gender }
    if (birthDate !== undefined) { user.birthDate = birthDate }
    if (isPrivate !== undefined) { user.isPrivate = isPrivate }

    await user.save()

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: sanitizeUser(user)
    })

  } catch (error) {
    logger.error('Error actualizando perfil:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.user.id).select('+password')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      })
    }

    // Actualizar contraseña
    user.password = newPassword
    await user.save()

    // Invalidar todos los tokens existentes del usuario
    await tokenService.blacklistAllUserTokens(user._id)
    logger.info(`Todos los tokens del usuario ${user._id} invalidados tras cambio de contraseña`)

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente. Por seguridad, debes iniciar sesión nuevamente.'
    })

  } catch (error) {
    logger.error('Error cambiando contraseña:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export const logout = async (req, res) => {
  try {
    // Agregar token actual a la blacklist
    if (req.token) {
      await tokenService.blacklistToken(req.token)
      logger.info(`Token agregado a blacklist para usuario ${req.user._id}`)
    }

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    })

  } catch (error) {
    logger.error('Error en logout:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export const refreshToken = async (req, res) => {
  try {
    // Obtener refresh token del body o header
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token']

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      })
    }

    // Renovar access token usando refresh token
    const result = await tokenService.refreshAccessToken(refreshToken)

    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido o expirado'
      })
    }

    // Obtener información del usuario
    const decoded = tokenService.decodeToken(refreshToken)
    const user = await User.findById(decoded.userId).select('-password')

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo'
      })
    }

    res.json({
      success: true,
      message: 'Token renovado exitosamente',
      accessToken: result.accessToken,
      user: sanitizeUser(user)
    })

  } catch (error) {
    logger.error('Error refrescando token:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Verificar disponibilidad de username
export const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username es requerido'
      })
    }

    const isAvailable = await User.isUsernameAvailable(username)

    res.json({
      success: true,
      available: isAvailable,
      username: username.toLowerCase()
    })

  } catch (error) {
    logger.error('Error verificando disponibilidad de username:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Solicitar recuperación de contraseña
export const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { email } = req.body

    // Buscar usuario por email
    const user = await User.findOne({ email: email.toLowerCase() })

    // Por seguridad, siempre devolver el mismo mensaje
    // (no revelar si el email existe o no)
    const successMessage = 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'

    if (!user) {
      logger.info('Forgot password solicitado para email no registrado:', { email })
      return res.json({
        success: true,
        message: successMessage
      })
    }

    // Crear token de reset
    const { token } = await PasswordReset.createResetToken(
      user._id,
      req.ip,
      req.get('user-agent')
    )

    // Enviar email
    try {
      await emailService.sendPasswordResetEmail(user.email, user.username, token)

      logger.info('Password reset email enviado:', {
        userId: user._id,
        email: user.email
      })
    } catch (emailError) {
      logger.error('Error enviando email de reset:', {
        error: emailError.message,
        userId: user._id
      })
      // No fallar la petición si el email falla
    }

    res.json({
      success: true,
      message: successMessage
    })

  } catch (error) {
    logger.error('Error en forgotPassword:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Restablecer contraseña con token
export const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { token, newPassword } = req.body

    // Verificar token
    const resetToken = await PasswordReset.verifyToken(token)

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      })
    }

    // Obtener usuario
    const user = await User.findById(resetToken.user)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Cambiar contraseña
    user.password = newPassword
    await user.save()

    // Marcar token como usado
    await resetToken.markAsUsed()

    // Invalidar todos los tokens JWT existentes del usuario
    await tokenService.invalidateAllUserTokens(user._id.toString())

    // Enviar email de confirmación
    try {
      await emailService.sendPasswordChangedEmail(user.email, user.username)
    } catch (emailError) {
      logger.error('Error enviando email de confirmación:', {
        error: emailError.message,
        userId: user._id
      })
    }

    logger.info('Contraseña restablecida exitosamente:', {
      userId: user._id,
      email: user.email
    })

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente. Puedes iniciar sesión con tu nueva contraseña.'
    })

  } catch (error) {
    logger.error('Error en resetPassword:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
