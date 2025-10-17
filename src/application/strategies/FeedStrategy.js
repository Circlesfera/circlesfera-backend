/**
 * FeedStrategy - Application Layer
 * Implementación del patrón Strategy para algoritmos de feed
 */

import { logger } from '../../utils/logger.js'

/**
 * Estrategia base para algoritmos de feed
 */
export class FeedStrategy {
  /**
   * Generar feed
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones del feed
   * @returns {Promise<Array>} Posts del feed
   */
  async generateFeed(userId, options = {}) {
    throw new Error('Método generateFeed debe ser implementado')
  }

  /**
   * Obtener nombre de la estrategia
   * @returns {string} Nombre de la estrategia
   */
  getName() {
    throw new Error('Método getName debe ser implementado')
  }
}

/**
 * Estrategia de feed cronológico
 */
export class ChronologicalFeedStrategy extends FeedStrategy {
  constructor(postRepository) {
    super()
    this.postRepository = postRepository
  }

  async generateFeed(userId, options = {}) {
    logger.info('Generando feed cronológico', { userId, options })

    const { limit = 20, page = 1 } = options

    // Obtener posts recientes
    const result = await this.postRepository.getRecentPosts({
      limit,
      page,
      sort: { createdAt: -1 }
    })

    return result.posts
  }

  getName() {
    return 'chronological'
  }
}

/**
 * Estrategia de feed por engagement
 */
export class EngagementFeedStrategy extends FeedStrategy {
  constructor(postRepository) {
    super()
    this.postRepository = postRepository
  }

  async generateFeed(userId, options = {}) {
    logger.info('Generando feed por engagement', { userId, options })

    const { limit = 20, days = 7 } = options

    // Obtener posts populares del período
    const posts = await this.postRepository.getPopularPosts({
      limit,
      days
    })

    return posts
  }

  getName() {
    return 'engagement'
  }
}

/**
 * Estrategia de feed personalizado
 */
export class PersonalizedFeedStrategy extends FeedStrategy {
  constructor(postRepository, userRepository) {
    super()
    this.postRepository = postRepository
    this.userRepository = userRepository
  }

  async generateFeed(userId, options = {}) {
    logger.info('Generando feed personalizado', { userId, options })

    const { limit = 20, page = 1 } = options

    try {
      // Obtener usuario y sus preferencias
      const user = await this.userRepository.findById(userId)
      if (!user) {
        throw new Error('Usuario no encontrado')
      }

      // Obtener usuarios seguidos
      const following = await this.userRepository.getFollowing(userId, { limit: 1000 })
      const followingIds = following.users.map(u => u.id)

      // Obtener posts de usuarios seguidos
      const result = await this.postRepository.findByUserIds(followingIds, {
        limit,
        page,
        sort: { createdAt: -1 }
      })

      // Aplicar algoritmo de personalización
      const personalizedPosts = this.applyPersonalizationAlgorithm(
        result.posts,
        user,
        options
      )

      return personalizedPosts
    } catch (error) {
      logger.error('Error generando feed personalizado', {
        error: error.message,
        userId
      })
      throw error
    }
  }

  /**
   * Aplicar algoritmo de personalización
   * @param {Array} posts - Posts a personalizar
   * @param {Object} user - Usuario
   * @param {Object} options - Opciones
   * @returns {Array} Posts personalizados
   */
  applyPersonalizationAlgorithm(posts, user, options) {
    // Algoritmo simple de personalización
    // En una implementación real, esto sería más complejo

    return posts.map(post => ({
      ...post,
      relevanceScore: this.calculateRelevanceScore(post, user)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  /**
   * Calcular score de relevancia
   * @param {Object} post - Post
   * @param {Object} user - Usuario
   * @returns {number} Score de relevancia
   */
  calculateRelevanceScore(post, user) {
    let score = 0

    // Score base por engagement
    const engagementScore = (post.likes.length * 1) +
      (post.comments.length * 2) +
      (post.shares * 3) +
      (post.views * 0.1)

    score += engagementScore

    // Bonus por contenido reciente
    const hoursSinceCreation = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
    if (hoursSinceCreation < 24) {
      score += 10
    } else if (hoursSinceCreation < 72) {
      score += 5
    }

    // Bonus por tags que le gustan al usuario
    if (user.preferences?.favoriteTags) {
      const matchingTags = post.tags.filter(tag =>
        user.preferences.favoriteTags.includes(tag)
      )
      score += matchingTags.length * 5
    }

    // Bonus por usuarios que sigue
    if (user.preferences?.favoriteUsers?.includes(post.userId)) {
      score += 15
    }

    return score
  }

  getName() {
    return 'personalized'
  }
}

/**
 * Estrategia de feed trending
 */
export class TrendingFeedStrategy extends FeedStrategy {
  constructor(postRepository) {
    super()
    this.postRepository = postRepository
  }

  async generateFeed(userId, options = {}) {
    logger.info('Generando feed trending', { userId, options })

    const { limit = 20, hours = 24 } = options

    // Obtener posts trending
    const posts = await this.postRepository.getTrendingPosts({
      limit,
      hours
    })

    return posts
  }

  getName() {
    return 'trending'
  }
}

/**
 * Context para usar estrategias de feed
 */
export class FeedContext {
  constructor() {
    this.strategy = null
  }

  /**
   * Establecer estrategia
   * @param {FeedStrategy} strategy - Estrategia a usar
   */
  setStrategy(strategy) {
    this.strategy = strategy
    logger.info('Estrategia de feed establecida', {
      strategy: strategy.getName()
    })
  }

  /**
   * Generar feed usando la estrategia actual
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones del feed
   * @returns {Promise<Array>} Posts del feed
   */
  async generateFeed(userId, options = {}) {
    if (!this.strategy) {
      throw new Error('No se ha establecido una estrategia de feed')
    }

    const startTime = Date.now()

    try {
      const posts = await this.strategy.generateFeed(userId, options)

      const duration = Date.now() - startTime
      logger.info('Feed generado exitosamente', {
        strategy: this.strategy.getName(),
        userId,
        postsCount: posts.length,
        duration
      })

      return posts
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Error generando feed', {
        strategy: this.strategy.getName(),
        userId,
        error: error.message,
        duration
      })
      throw error
    }
  }

  /**
   * Obtener nombre de la estrategia actual
   * @returns {string} Nombre de la estrategia
   */
  getCurrentStrategy() {
    return this.strategy ? this.strategy.getName() : null
  }
}

/**
 * Factory para crear estrategias de feed
 */
export class FeedStrategyFactory {
  /**
   * Crear estrategia de feed
   * @param {string} type - Tipo de estrategia
   * @param {Object} dependencies - Dependencias
   * @returns {FeedStrategy} Estrategia creada
   */
  static createStrategy(type, dependencies) {
    const { postRepository, userRepository } = dependencies

    switch (type) {
      case 'chronological':
        return new ChronologicalFeedStrategy(postRepository)

      case 'engagement':
        return new EngagementFeedStrategy(postRepository)

      case 'personalized':
        return new PersonalizedFeedStrategy(postRepository, userRepository)

      case 'trending':
        return new TrendingFeedStrategy(postRepository)

      default:
        throw new Error(`Tipo de estrategia de feed no soportado: ${type}`)
    }
  }

  /**
   * Obtener tipos de estrategias disponibles
   * @returns {Array} Tipos disponibles
   */
  static getAvailableStrategies() {
    return ['chronological', 'engagement', 'personalized', 'trending']
  }
}
