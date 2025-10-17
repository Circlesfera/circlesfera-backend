/**
 * CreatePostUseCase - Application Layer
 * Caso de uso para crear un nuevo post
 * Implementa la lógica de negocio para la creación de publicaciones
 */

import { Post } from '../../../domain/entities/Post.js'
import { logger } from '../../../utils/logger.js'

export class CreatePostUseCase {
  constructor(
    postRepository,
    userRepository,
    notificationService,
    cacheService,
    analyticsService,
    mediaService
  ) {
    this.postRepository = postRepository
    this.userRepository = userRepository
    this.notificationService = notificationService
    this.cacheService = cacheService
    this.analyticsService = analyticsService
    this.mediaService = mediaService
  }

  /**
   * Ejecutar el caso de uso de crear post
   * @param {string} userId - ID del usuario que crea el post
   * @param {Object} postData - Datos del post a crear
   * @returns {Promise<Post>} Post creado
   */
  async execute(userId, postData) {
    try {
      logger.info('Iniciando creación de post', {
        userId,
        type: postData.type,
        hasMedia: !!postData.media
      })

      // 1. Validar datos de entrada
      await this.validatePostData(postData)

      // 2. Verificar que el usuario existe y está activo
      const user = await this.userRepository.findById(userId)
      if (!user || !user.isActive) {
        throw new Error('Usuario no encontrado o inactivo')
      }

      // 3. Procesar media si existe
      const processedMedia = await this.processMedia(postData.media, userId)

      // 4. Crear entidad de post
      const post = new Post({
        id: null, // Se asignará al guardar
        userId: userId,
        type: postData.type,
        caption: postData.caption || '',
        content: {
          text: postData.caption,
          media: processedMedia,
          location: postData.location || null
        },
        location: postData.location || null,
        tags: postData.tags || [],
        mentions: postData.mentions || [],
        likes: [],
        comments: [],
        shares: 0,
        views: 0,
        isPublic: postData.isPublic !== false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // 5. Guardar post en repositorio
      const savedPost = await this.postRepository.save(post)

      // 6. Actualizar contador de posts del usuario
      await this.updateUserPostCount(userId)

      // 7. Procesar menciones (asíncrono)
      this.processMentions(savedPost, user).catch(error => {
        logger.error('Error procesando menciones', {
          error: error.message,
          postId: savedPost.id
        })
      })

      // 8. Enviar notificaciones a seguidores (asíncrono)
      this.notifyFollowers(savedPost, user).catch(error => {
        logger.error('Error notificando seguidores', {
          error: error.message,
          postId: savedPost.id
        })
      })

      // 9. Invalidar cache relacionado
      await this.invalidateRelatedCache(userId)

      // 10. Registrar analytics (asíncrono)
      this.recordPostCreation(savedPost, user).catch(error => {
        logger.warn('Error registrando analytics', {
          error: error.message,
          postId: savedPost.id
        })
      })

      logger.info('Post creado exitosamente', {
        postId: savedPost.id,
        userId,
        type: savedPost.type
      })

      return savedPost

    } catch (error) {
      logger.error('Error en CreatePostUseCase', {
        error: error.message,
        stack: error.stack,
        userId,
        type: postData.type
      })
      throw error
    }
  }

  /**
   * Validar datos del post
   * @param {Object} postData - Datos a validar
   */
  async validatePostData(postData) {
    // Validar tipo de post
    const validTypes = ['text', 'image', 'video', 'reel', 'story']
    if (!validTypes.includes(postData.type)) {
      throw new Error(`Tipo de post inválido: ${postData.type}`)
    }

    // Validar que tenga contenido
    if (!postData.caption && !postData.media) {
      throw new Error('El post debe tener caption o media')
    }

    // Validar longitud de caption
    if (postData.caption && postData.caption.length > 2200) {
      throw new Error('El caption es demasiado largo (máximo 2200 caracteres)')
    }

    // Validar cantidad de media
    if (postData.media && postData.media.length > 10) {
      throw new Error('Máximo 10 archivos de media por post')
    }

    // Validar tags
    if (postData.tags && postData.tags.length > 5) {
      throw new Error('Máximo 5 tags por post')
    }
  }

  /**
   * Procesar media del post
   * @param {Array} media - Array de archivos de media
   * @param {string} userId - ID del usuario
   * @returns {Promise<Array>} Media procesada
   */
  async processMedia(media, userId) {
    if (!media || media.length === 0) {
      return []
    }

    const processedMedia = []

    for (const file of media) {
      try {
        // Procesar cada archivo de media
        const processedFile = await this.mediaService.processMedia(file, {
          userId,
          type: 'post'
        })

        processedMedia.push({
          id: processedFile.id,
          url: processedFile.url,
          type: processedFile.type,
          size: processedFile.size,
          duration: processedFile.duration || null,
          thumbnail: processedFile.thumbnail || null
        })
      } catch (error) {
        logger.error('Error procesando media', {
          error: error.message,
          fileName: file.originalname,
          userId
        })
        throw new Error(`Error procesando archivo: ${file.originalname}`)
      }
    }

    return processedMedia
  }

  /**
   * Actualizar contador de posts del usuario
   * @param {string} userId - ID del usuario
   */
  async updateUserPostCount(userId) {
    try {
      await this.userRepository.incrementPostsCount(userId)
    } catch (error) {
      logger.error('Error actualizando contador de posts', {
        error: error.message,
        userId
      })
      // No relanzar el error para no afectar la creación del post
    }
  }

  /**
   * Procesar menciones en el post
   * @param {Post} post - Post creado
   * @param {User} user - Usuario que creó el post
   */
  async processMentions(post, user) {
    if (!post.mentions || post.mentions.length === 0) {
      return
    }

    try {
      // Obtener usuarios mencionados
      const mentionedUsers = await this.userRepository.findByIds(post.mentions)

      // Enviar notificaciones a usuarios mencionados
      for (const mentionedUser of mentionedUsers) {
        await this.notificationService.createNotification({
          type: 'mention',
          userId: mentionedUser.id,
          fromUserId: user.id,
          postId: post.id,
          message: `${user.username} te mencionó en un post`,
          data: {
            postId: post.id,
            postType: post.type,
            mentionedBy: user.username
          }
        })
      }

      logger.info('Menciones procesadas', {
        postId: post.id,
        mentionsCount: mentionedUsers.length
      })
    } catch (error) {
      logger.error('Error procesando menciones', {
        error: error.message,
        postId: post.id
      })
    }
  }

  /**
   * Notificar a seguidores sobre el nuevo post
   * @param {Post} post - Post creado
   * @param {User} user - Usuario que creó el post
   */
  async notifyFollowers(post, user) {
    try {
      // Obtener seguidores del usuario
      const followers = await this.userRepository.getFollowers(user.id, {
        limit: 1000 // Límite para evitar spam
      })

      // Crear notificaciones para seguidores
      const notifications = followers.users.map(follower => ({
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
      }))

      // Enviar notificaciones en lotes
      await this.notificationService.createBulkNotifications(notifications)

      logger.info('Notificaciones enviadas a seguidores', {
        postId: post.id,
        followersCount: followers.users.length
      })
    } catch (error) {
      logger.error('Error notificando seguidores', {
        error: error.message,
        postId: post.id
      })
    }
  }

  /**
   * Invalidar cache relacionado
   * @param {string} userId - ID del usuario
   */
  async invalidateRelatedCache(userId) {
    try {
      await Promise.all([
        this.cacheService.delete(`user:${userId}:posts`),
        this.cacheService.delete(`user:${userId}:feed`),
        this.cacheService.delete('posts:recent'),
        this.cacheService.delete('posts:trending'),
        this.cacheService.delete('posts:popular')
      ])
    } catch (error) {
      logger.warn('Error invalidando cache relacionado', {
        error: error.message,
        userId
      })
    }
  }

  /**
   * Registrar creación de post en analytics
   * @param {Post} post - Post creado
   * @param {User} user - Usuario que creó el post
   */
  async recordPostCreation(post, user) {
    try {
      await this.analyticsService.trackEvent({
        type: 'post_created',
        userId: user.id,
        postId: post.id,
        postType: post.type,
        hasMedia: post.content.media.length > 0,
        tagsCount: post.tags.length,
        mentionsCount: post.mentions.length,
        timestamp: new Date()
      })
    } catch (error) {
      logger.warn('Error registrando analytics de post', {
        error: error.message,
        postId: post.id
      })
    }
  }
}
