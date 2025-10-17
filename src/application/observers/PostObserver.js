/**
 * PostObserver - Application Layer
 * Implementación del patrón Observer para eventos de posts
 */

import { logger } from '../../utils/logger.js'

/**
 * Interfaz base para observadores de posts
 */
export class PostObserver {
  /**
   * Actualizar cuando se crea un post
   * @param {Object} post - Post creado
   * @param {Object} user - Usuario que creó el post
   */
  updatePostCreated(post, user) {
    throw new Error('Método updatePostCreated debe ser implementado')
  }

  /**
   * Actualizar cuando se elimina un post
   * @param {string} postId - ID del post eliminado
   * @param {string} userId - ID del usuario
   */
  updatePostDeleted(postId, userId) {
    throw new Error('Método updatePostDeleted debe ser implementado')
  }

  /**
   * Actualizar cuando se da like a un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que dio like
   */
  updatePostLiked(postId, userId) {
    throw new Error('Método updatePostLiked debe ser implementado')
  }

  /**
   * Actualizar cuando se quita like de un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que quitó like
   */
  updatePostUnliked(postId, userId) {
    throw new Error('Método updatePostUnliked debe ser implementado')
  }

  /**
   * Actualizar cuando se comenta un post
   * @param {string} postId - ID del post
   * @param {Object} comment - Comentario agregado
   */
  updatePostCommented(postId, comment) {
    throw new Error('Método updatePostCommented debe ser implementado')
  }

  /**
   * Obtener nombre del observador
   * @returns {string} Nombre del observador
   */
  getName() {
    throw new Error('Método getName debe ser implementado')
  }
}

/**
 * Observador para notificaciones de posts
 */
export class PostNotificationObserver extends PostObserver {
  constructor(notificationService) {
    super()
    this.notificationService = notificationService
  }

  async updatePostCreated(post, user) {
    try {
      logger.info('Enviando notificaciones por nuevo post', {
        postId: post.id,
        userId: user.id
      })

      // Obtener seguidores del usuario
      const followers = await this.getUserFollowers(user.id)

      // Enviar notificaciones a seguidores
      for (const follower of followers) {
        await this.notificationService.createNotification({
          type: 'new_post',
          userId: follower.id,
          fromUserId: user.id,
          postId: post.id,
          message: `${user.username} compartió una nueva publicación`,
          data: {
            postId: post.id,
            postType: post.type,
            author: user.username
          }
        })
      }

      logger.info('Notificaciones de post enviadas', {
        postId: post.id,
        followersCount: followers.length
      })
    } catch (error) {
      logger.error('Error enviando notificaciones de post', {
        error: error.message,
        postId: post.id
      })
    }
  }

  async updatePostLiked(postId, userId) {
    try {
      // Obtener información del post y usuario que dio like
      const post = await this.getPostById(postId)
      const liker = await this.getUserById(userId)

      if (!post || !liker) {
        return
      }

      // Solo notificar si no es el autor del post
      if (post.userId !== userId) {
        await this.notificationService.createNotification({
          type: 'post_liked',
          userId: post.userId,
          fromUserId: userId,
          postId: postId,
          message: `${liker.username} le gustó tu publicación`,
          data: {
            postId: postId,
            liker: liker.username
          }
        })
      }
    } catch (error) {
      logger.error('Error enviando notificación de like', {
        error: error.message,
        postId,
        userId
      })
    }
  }

  async updatePostCommented(postId, comment) {
    try {
      // Obtener información del post
      const post = await this.getPostById(postId)
      const commenter = await this.getUserById(comment.userId)

      if (!post || !commenter) {
        return
      }

      // Solo notificar si no es el autor del post
      if (post.userId !== comment.userId) {
        await this.notificationService.createNotification({
          type: 'post_commented',
          userId: post.userId,
          fromUserId: comment.userId,
          postId: postId,
          message: `${commenter.username} comentó tu publicación`,
          data: {
            postId: postId,
            commentId: comment.id,
            commenter: commenter.username
          }
        })
      }
    } catch (error) {
      logger.error('Error enviando notificación de comentario', {
        error: error.message,
        postId,
        commentId: comment.id
      })
    }
  }

  async getUserFollowers(userId) {
    // Implementación para obtener seguidores
    // Por ahora retornamos un array vacío
    return []
  }

  async getPostById(postId) {
    // Implementación para obtener post por ID
    // Por ahora retornamos null
    return null
  }

  async getUserById(userId) {
    // Implementación para obtener usuario por ID
    // Por ahora retornamos null
    return null
  }

  getName() {
    return 'PostNotificationObserver'
  }
}

/**
 * Observador para analytics de posts
 */
export class PostAnalyticsObserver extends PostObserver {
  constructor(analyticsService) {
    super()
    this.analyticsService = analyticsService
  }

  async updatePostCreated(post, user) {
    try {
      await this.analyticsService.trackEvent({
        type: 'post_created',
        userId: user.id,
        postId: post.id,
        postType: post.type,
        hasMedia: post.content?.media?.length > 0,
        tagsCount: post.tags?.length || 0,
        mentionsCount: post.mentions?.length || 0,
        timestamp: new Date()
      })

      logger.info('Analytics de post creado registrado', {
        postId: post.id,
        userId: user.id
      })
    } catch (error) {
      logger.error('Error registrando analytics de post creado', {
        error: error.message,
        postId: post.id
      })
    }
  }

  async updatePostLiked(postId, userId) {
    try {
      await this.analyticsService.trackEvent({
        type: 'post_liked',
        userId: userId,
        postId: postId,
        timestamp: new Date()
      })
    } catch (error) {
      logger.error('Error registrando analytics de like', {
        error: error.message,
        postId,
        userId
      })
    }
  }

  async updatePostCommented(postId, comment) {
    try {
      await this.analyticsService.trackEvent({
        type: 'post_commented',
        userId: comment.userId,
        postId: postId,
        commentId: comment.id,
        timestamp: new Date()
      })
    } catch (error) {
      logger.error('Error registrando analytics de comentario', {
        error: error.message,
        postId,
        commentId: comment.id
      })
    }
  }

  getName() {
    return 'PostAnalyticsObserver'
  }
}

/**
 * Observador para cache de posts
 */
export class PostCacheObserver extends PostObserver {
  constructor(cacheService) {
    super()
    this.cacheService = cacheService
  }

  async updatePostCreated(post, user) {
    try {
      // Invalidar cache relacionado
      await Promise.all([
        this.cacheService.delete(`user:${user.id}:posts`),
        this.cacheService.delete(`user:${user.id}:feed`),
        this.cacheService.delete('posts:recent'),
        this.cacheService.delete('posts:trending'),
        this.cacheService.delete('posts:popular')
      ])

      logger.info('Cache invalidado por nuevo post', {
        postId: post.id,
        userId: user.id
      })
    } catch (error) {
      logger.error('Error invalidando cache por nuevo post', {
        error: error.message,
        postId: post.id
      })
    }
  }

  async updatePostDeleted(postId, userId) {
    try {
      // Invalidar cache relacionado
      await Promise.all([
        this.cacheService.delete(`user:${userId}:posts`),
        this.cacheService.delete(`post:${postId}`),
        this.cacheService.delete('posts:recent'),
        this.cacheService.delete('posts:trending')
      ])

      logger.info('Cache invalidado por post eliminado', {
        postId,
        userId
      })
    } catch (error) {
      logger.error('Error invalidando cache por post eliminado', {
        error: error.message,
        postId
      })
    }
  }

  async updatePostLiked(postId, userId) {
    try {
      // Invalidar cache del post específico
      await this.cacheService.delete(`post:${postId}`)
    } catch (error) {
      logger.error('Error invalidando cache por like', {
        error: error.message,
        postId
      })
    }
  }

  async updatePostCommented(postId, comment) {
    try {
      // Invalidar cache del post específico
      await this.cacheService.delete(`post:${postId}`)
    } catch (error) {
      logger.error('Error invalidando cache por comentario', {
        error: error.message,
        postId
      })
    }
  }

  getName() {
    return 'PostCacheObserver'
  }
}

/**
 * Sujeto observable para posts
 */
export class PostSubject {
  constructor() {
    this.observers = []
  }

  /**
   * Agregar observador
   * @param {PostObserver} observer - Observador a agregar
   */
  addObserver(observer) {
    this.observers.push(observer)
    logger.info('Observador agregado', {
      observer: observer.getName(),
      totalObservers: this.observers.length
    })
  }

  /**
   * Remover observador
   * @param {PostObserver} observer - Observador a remover
   */
  removeObserver(observer) {
    const index = this.observers.indexOf(observer)
    if (index > -1) {
      this.observers.splice(index, 1)
      logger.info('Observador removido', {
        observer: observer.getName(),
        totalObservers: this.observers.length
      })
    }
  }

  /**
   * Notificar observadores sobre post creado
   * @param {Object} post - Post creado
   * @param {Object} user - Usuario que creó el post
   */
  async notifyPostCreated(post, user) {
    logger.info('Notificando post creado a observadores', {
      postId: post.id,
      observersCount: this.observers.length
    })

    for (const observer of this.observers) {
      try {
        await observer.updatePostCreated(post, user)
      } catch (error) {
        logger.error('Error notificando observador', {
          observer: observer.getName(),
          error: error.message
        })
      }
    }
  }

  /**
   * Notificar observadores sobre post eliminado
   * @param {string} postId - ID del post eliminado
   * @param {string} userId - ID del usuario
   */
  async notifyPostDeleted(postId, userId) {
    logger.info('Notificando post eliminado a observadores', {
      postId,
      observersCount: this.observers.length
    })

    for (const observer of this.observers) {
      try {
        await observer.updatePostDeleted(postId, userId)
      } catch (error) {
        logger.error('Error notificando observador', {
          observer: observer.getName(),
          error: error.message
        })
      }
    }
  }

  /**
   * Notificar observadores sobre post con like
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que dio like
   */
  async notifyPostLiked(postId, userId) {
    logger.info('Notificando post con like a observadores', {
      postId,
      userId,
      observersCount: this.observers.length
    })

    for (const observer of this.observers) {
      try {
        await observer.updatePostLiked(postId, userId)
      } catch (error) {
        logger.error('Error notificando observador', {
          observer: observer.getName(),
          error: error.message
        })
      }
    }
  }

  /**
   * Notificar observadores sobre post sin like
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que quitó like
   */
  async notifyPostUnliked(postId, userId) {
    logger.info('Notificando post sin like a observadores', {
      postId,
      userId,
      observersCount: this.observers.length
    })

    for (const observer of this.observers) {
      try {
        await observer.updatePostUnliked(postId, userId)
      } catch (error) {
        logger.error('Error notificando observador', {
          observer: observer.getName(),
          error: error.message
        })
      }
    }
  }

  /**
   * Notificar observadores sobre comentario en post
   * @param {string} postId - ID del post
   * @param {Object} comment - Comentario agregado
   */
  async notifyPostCommented(postId, comment) {
    logger.info('Notificando comentario en post a observadores', {
      postId,
      commentId: comment.id,
      observersCount: this.observers.length
    })

    for (const observer of this.observers) {
      try {
        await observer.updatePostCommented(postId, comment)
      } catch (error) {
        logger.error('Error notificando observador', {
          observer: observer.getName(),
          error: error.message
        })
      }
    }
  }

  /**
   * Obtener número de observadores
   * @returns {number} Número de observadores
   */
  getObserversCount() {
    return this.observers.length
  }

  /**
   * Obtener nombres de observadores
   * @returns {Array} Nombres de observadores
   */
  getObserversNames() {
    return this.observers.map(observer => observer.getName())
  }
}
