/**
 * CreateUserUseCase - Application Layer
 * Caso de uso para crear un nuevo usuario
 * Implementa la lógica de negocio para el registro de usuarios
 */

import { User } from '../../../domain/entities/User.js'
import { logger } from '../../../utils/logger.js'

export class CreateUserUseCase {
  constructor(userRepository, authService, emailService, cacheService) {
    this.userRepository = userRepository
    this.authService = authService
    this.emailService = emailService
    this.cacheService = cacheService
  }

  /**
   * Ejecutar el caso de uso de crear usuario
   * @param {Object} userData - Datos del usuario a crear
   * @returns {Promise<{user: User, tokens: Object}>} Usuario creado y tokens
   */
  async execute(userData) {
    try {
      logger.info('Iniciando creación de usuario', {
        username: userData.username,
        email: userData.email
      })

      // 1. Validar datos de entrada
      await this.validateUserData(userData)

      // 2. Verificar que username y email no existan
      await this.checkAvailability(userData.username, userData.email)

      // 3. Crear entidad de usuario
      const user = new User({
        id: null, // Se asignará al guardar
        username: userData.username,
        email: userData.email,
        fullName: userData.fullName,
        bio: userData.bio || '',
        avatar: userData.avatar || null,
        isVerified: false,
        isActive: true,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        privacySettings: {
          profileVisibility: 'public',
          showEmail: false,
          showFollowers: true,
          showFollowing: true
        },
        notificationSettings: {
          likes: true,
          comments: true,
          follows: true,
          mentions: true,
          messages: true
        },
        blockedUsers: [],
        blockedBy: [],
        preferences: {
          language: userData.language || 'es',
          theme: 'light',
          emailNotifications: true
        }
      })

      // 4. Guardar usuario en repositorio
      const savedUser = await this.userRepository.save(user)

      // 5. Generar tokens de autenticación
      const tokens = await this.authService.generateTokens(savedUser.id)

      // 6. Enviar email de bienvenida (asíncrono)
      this.sendWelcomeEmail(savedUser).catch(error => {
        logger.error('Error enviando email de bienvenida', {
          userId: savedUser.id,
          error: error.message
        })
      })

      // 7. Invalidar cache relacionado
      await this.invalidateRelatedCache()

      logger.info('Usuario creado exitosamente', {
        userId: savedUser.id,
        username: savedUser.username
      })

      return {
        user: savedUser,
        tokens
      }

    } catch (error) {
      logger.error('Error en CreateUserUseCase', {
        error: error.message,
        stack: error.stack,
        username: userData.username
      })
      throw error
    }
  }

  /**
   * Validar datos del usuario
   * @param {Object} userData - Datos a validar
   */
  async validateUserData(userData) {
    const requiredFields = ['username', 'email', 'password']

    for (const field of requiredFields) {
      if (!userData[field]) {
        throw new Error(`Campo requerido: ${field}`)
      }
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userData.email)) {
      throw new Error('Formato de email inválido')
    }

    // Validar formato de username
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(userData.username)) {
      throw new Error('Username debe tener entre 3 y 20 caracteres y solo contener letras, números y guiones bajos')
    }

    // Validar longitud de contraseña
    if (userData.password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres')
    }
  }

  /**
   * Verificar disponibilidad de username y email
   * @param {string} username - Username a verificar
   * @param {string} email - Email a verificar
   */
  async checkAvailability(username, email) {
    const [usernameAvailable, emailAvailable] = await Promise.all([
      this.userRepository.isUsernameAvailable(username),
      this.userRepository.isEmailAvailable(email)
    ])

    if (!usernameAvailable) {
      throw new Error('El username ya está en uso')
    }

    if (!emailAvailable) {
      throw new Error('El email ya está registrado')
    }
  }

  /**
   * Enviar email de bienvenida
   * @param {User} user - Usuario creado
   */
  async sendWelcomeEmail(user) {
    try {
      await this.emailService.sendWelcomeEmail({
        to: user.email,
        username: user.username,
        fullName: user.fullName
      })

      logger.info('Email de bienvenida enviado', {
        userId: user.id,
        email: user.email
      })
    } catch (error) {
      logger.error('Error enviando email de bienvenida', {
        userId: user.id,
        error: error.message
      })
      // No relanzar el error para no afectar la creación del usuario
    }
  }

  /**
   * Invalidar cache relacionado
   */
  async invalidateRelatedCache() {
    try {
      await Promise.all([
        this.cacheService.delete('users:count'),
        this.cacheService.delete('users:recent'),
        this.cacheService.delete('users:top')
      ])
    } catch (error) {
      logger.warn('Error invalidando cache relacionado', {
        error: error.message
      })
    }
  }
}
