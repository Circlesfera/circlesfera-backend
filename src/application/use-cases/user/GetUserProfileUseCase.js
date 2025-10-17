/**
 * GetUserProfileUseCase - Application Layer
 * Caso de uso para obtener el perfil de un usuario
 * Implementa la lógica de negocio para consultar perfiles
 */

import { logger } from '../../../utils/logger.js'

export class GetUserProfileUseCase {
  constructor(userRepository, cacheService, analyticsService) {
    this.userRepository = userRepository
    this.cacheService = cacheService
    this.analyticsService = analyticsService
  }

  /**
   * Ejecutar el caso de uso de obtener perfil
   * @param {string} userId - ID del usuario solicitante
   * @param {string} targetUserId - ID del usuario cuyo perfil se solicita
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<User>} Perfil del usuario
   */
  async execute(userId, targetUserId, options = {}) {
    try {
      logger.info('Obteniendo perfil de usuario', {
        userId,
        targetUserId,
        includePrivate: options.includePrivate || false
      })

      // 1. Verificar cache
      const cacheKey = `user:profile:${targetUserId}:${userId}`
      const cachedProfile = await this.getCachedProfile(cacheKey)

      if (cachedProfile && !options.includePrivate) {
        logger.debug('Perfil obtenido desde cache', { targetUserId })
        return cachedProfile
      }

      // 2. Obtener usuario desde repositorio
      const user = await this.userRepository.findById(targetUserId)
      if (!user) {
        throw new Error('Usuario no encontrado')
      }

      // 3. Verificar permisos de acceso
      const hasAccess = await this.checkAccessPermissions(userId, user, options)
      if (!hasAccess) {
        throw new Error('No tienes permisos para ver este perfil')
      }

      // 4. Enriquecer perfil con datos adicionales
      const enrichedProfile = await this.enrichProfile(user, userId, options)

      // 5. Cachear resultado
      await this.cacheProfile(cacheKey, enrichedProfile)

      // 6. Registrar analytics (asíncrono)
      this.recordProfileView(userId, targetUserId).catch(error => {
        logger.warn('Error registrando analytics de perfil', {
          error: error.message,
          userId,
          targetUserId
        })
      })

      logger.info('Perfil obtenido exitosamente', {
        targetUserId,
        isPublic: user.isPublic
      })

      return enrichedProfile

    } catch (error) {
      logger.error('Error en GetUserProfileUseCase', {
        error: error.message,
        userId,
        targetUserId
      })
      throw error
    }
  }

  /**
   * Obtener perfil desde cache
   * @param {string} cacheKey - Clave del cache
   * @returns {Promise<User|null>} Perfil en cache o null
   */
  async getCachedProfile(cacheKey) {
    try {
      const cached = await this.cacheService.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Error obteniendo perfil desde cache', {
        error: error.message,
        cacheKey
      })
      return null
    }
  }

  /**
   * Verificar permisos de acceso al perfil
   * @param {string} userId - ID del usuario solicitante
   * @param {User} targetUser - Usuario objetivo
   * @param {Object} options - Opciones de acceso
   * @returns {Promise<boolean>} True si tiene acceso
   */
  async checkAccessPermissions(userId, targetUser, options) {
    // Si es el mismo usuario, siempre tiene acceso
    if (userId === targetUser.id) {
      return true
    }

    // Si el perfil es público, tiene acceso
    if (targetUser.privacySettings?.profileVisibility === 'public') {
      return true
    }

    // Si está solicitando acceso privado y es admin
    if (options.includePrivate && await this.isAdmin(userId)) {
      return true
    }

    // Si son amigos o el usuario objetivo lo sigue
    if (await this.areConnected(userId, targetUser.id)) {
      return true
    }

    return false
  }

  /**
   * Enriquecer perfil con datos adicionales
   * @param {User} user - Usuario base
   * @param {string} viewerId - ID del usuario que ve el perfil
   * @param {Object} options - Opciones de enriquecimiento
   * @returns {Promise<User>} Usuario enriquecido
   */
  async enrichProfile(user, viewerId, options) {
    const enrichedUser = { ...user }

    // Agregar información de relación si no es el mismo usuario
    if (viewerId !== user.id) {
      enrichedUser.relationship = await this.getRelationshipInfo(viewerId, user.id)
    }

    // Agregar estadísticas si se solicitan
    if (options.includeStats) {
      enrichedUser.stats = await this.userRepository.getStats(user.id)
    }

    // Agregar posts recientes si se solicitan
    if (options.includeRecentPosts) {
      enrichedUser.recentPosts = await this.getRecentPosts(user.id, {
        limit: options.recentPostsLimit || 5
      })
    }

    // Filtrar información sensible según permisos
    if (!options.includePrivate && viewerId !== user.id) {
      delete enrichedUser.email
      delete enrichedUser.phone
      delete enrichedUser.privacySettings
      delete enrichedUser.notificationSettings
    }

    return enrichedUser
  }

  /**
   * Obtener información de relación entre usuarios
   * @param {string} viewerId - ID del usuario que ve
   * @param {string} targetId - ID del usuario objetivo
   * @returns {Promise<Object>} Información de relación
   */
  async getRelationshipInfo(viewerId, targetId) {
    try {
      // Aquí implementarías la lógica para obtener:
      // - Si se siguen mutuamente
      // - Si están bloqueados
      // - Estado de la relación
      return {
        isFollowing: false,
        isFollowedBy: false,
        isBlocked: false,
        isBlockedBy: false
      }
    } catch (error) {
      logger.warn('Error obteniendo información de relación', {
        error: error.message,
        viewerId,
        targetId
      })
      return {
        isFollowing: false,
        isFollowedBy: false,
        isBlocked: false,
        isBlockedBy: false
      }
    }
  }

  /**
   * Obtener posts recientes del usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} Posts recientes
   */
  async getRecentPosts(userId, options = {}) {
    try {
      // Aquí implementarías la consulta a PostRepository
      // Por ahora retornamos un array vacío
      return []
    } catch (error) {
      logger.warn('Error obteniendo posts recientes', {
        error: error.message,
        userId
      })
      return []
    }
  }

  /**
   * Verificar si un usuario es admin
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} True si es admin
   */
  async isAdmin(userId) {
    try {
      const user = await this.userRepository.findById(userId)
      return user?.role === 'admin'
    } catch (error) {
      logger.warn('Error verificando rol de admin', {
        error: error.message,
        userId
      })
      return false
    }
  }

  /**
   * Verificar si dos usuarios están conectados
   * @param {string} userId1 - ID del primer usuario
   * @param {string} userId2 - ID del segundo usuario
   * @returns {Promise<boolean>} True si están conectados
   */
  async areConnected(userId1, userId2) {
    try {
      // Implementar lógica para verificar si son amigos o se siguen
      // Por ahora retornamos false
      return false
    } catch (error) {
      logger.warn('Error verificando conexión entre usuarios', {
        error: error.message,
        userId1,
        userId2
      })
      return false
    }
  }

  /**
   * Cachear perfil
   * @param {string} cacheKey - Clave del cache
   * @param {User} profile - Perfil a cachear
   */
  async cacheProfile(cacheKey, profile) {
    try {
      await this.cacheService.set(
        cacheKey,
        JSON.stringify(profile),
        300 // 5 minutos
      )
    } catch (error) {
      logger.warn('Error cacheando perfil', {
        error: error.message,
        cacheKey
      })
    }
  }

  /**
   * Registrar vista de perfil en analytics
   * @param {string} viewerId - ID del usuario que ve
   * @param {string} targetId - ID del usuario visto
   */
  async recordProfileView(viewerId, targetId) {
    try {
      await this.analyticsService.trackEvent({
        type: 'profile_view',
        userId: viewerId,
        targetUserId: targetId,
        timestamp: new Date()
      })
    } catch (error) {
      logger.warn('Error registrando vista de perfil', {
        error: error.message,
        viewerId,
        targetId
      })
    }
  }
}
