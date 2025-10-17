/**
 * 📝 REFACTORED POST CONTROLLER
 * =============================
 * Controlador de posts refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import { config } from '../utils/config.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class PostController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para crear post
  static createPostValidations = [
    body('type')
      .isIn(['text', 'image', 'video'])
      .withMessage('Tipo de publicación inválido'),
    body('caption')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2200 })
      .withMessage('El caption no puede exceder los 2200 caracteres'),
    body('location')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage('La ubicación no puede exceder los 100 caracteres'),
    body('tags')
      .optional()
      .isString()
      .trim()
      .withMessage('Los tags deben ser una cadena de texto'),
    body('textContent')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage('El contenido de texto no puede estar vacío para publicaciones de texto'),
    body('aspectRatio')
      .optional()
      .isString()
      .trim()
      .withMessage('El aspect ratio debe ser una cadena de texto'),
    body('originalAspectRatio')
      .optional()
      .isString()
      .trim()
      .withMessage('El aspect ratio original debe ser una cadena de texto')
  ]

  // Validaciones para actualizar post
  static updatePostValidations = [
    body('caption')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 2200 })
      .withMessage('El caption no puede exceder los 2200 caracteres'),
    body('location')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage('La ubicación no puede exceder los 100 caracteres')
  ]

  /**
   * Crear una nueva publicación
   */
  async createPost(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { type, caption, location, tags, textContent, aspectRatio, originalAspectRatio } = req.body
      const { userId } = req

      const postData = {
        user: userId,
        type: type || 'text',
        caption: caption || '',
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      }

      // Inicializar content object
      postData.content = {}

      // Agregar ubicación si se proporciona
      if (location) {
        postData.location = { name: location }
      }

      // Obtener la URL base del servidor
      const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`

      // Manejar diferentes tipos de contenido
      switch (type) {
        case 'image': {
          if (!req.files || !req.files.images) {
            return PostController.error(res, 'La imagen es obligatoria para publicaciones de imagen', 400)
          }

          const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images]
          postData.content = {
            images: images.map(file => ({
              url: `${baseUrl}/uploads/${file.filename}`,
              alt: caption || '',
              width: 0,
              height: 0
            })),
            aspectRatio: aspectRatio || '1:1',
            originalAspectRatio: originalAspectRatio || '1:1'
          }
          break
        }

        case 'video': {
          if (!req.files || !req.files.video) {
            return PostController.error(res, 'El video es obligatorio para publicaciones de video', 400)
          }

          const videoFile = Array.isArray(req.files.video) ? req.files.video[0] : req.files.video
          postData.content = {
            video: {
              url: `${baseUrl}/uploads/${videoFile.filename}`,
              thumbnail: `${baseUrl}/uploads/${videoFile.filename.split('.')[0]}-thumbnail.png`,
              aspectRatio: aspectRatio || '16:9',
              duration: 0
            }
          }
          break
        }

        case 'text':
        default: {
          if (!textContent) {
            return PostController.error(res, 'El contenido de texto es obligatorio para publicaciones de texto', 400)
          }
          postData.content.text = textContent
          break
        }
      }

      const post = new Post(postData)
      await post.save()

      // Poblar datos del usuario
      await post.populate('user', 'username fullName avatar')

      // Crear notificaciones para seguidores
      await this.createPostNotifications(post)

      // Limpiar cache relacionado
      await cache.del('feed:*')
      await cache.del(`user:${userId}:posts`)

      logger.info('Post creado exitosamente', { postId: post._id, userId })

      return PostController.success(res, post, 'Publicación creada exitosamente', 201)

    } catch (error) {
      logger.error('Error creando post:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Obtener feed de publicaciones
   */
  async getFeed(req, res) {
    try {
      const { userId } = req
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar cache
      const cacheKey = `feed:${userId}:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedFeed = await cache.get(cacheKey)

      if (cachedFeed) {
        return PostController.success(res, JSON.parse(cachedFeed), 'Feed obtenido del cache')
      }

      // Obtener usuarios seguidos
      const user = await User.findById(userId).populate('following')
      const followingIds = user.following.map(follow => follow._id)
      followingIds.push(userId) // Incluir posts propios

      // Obtener posts
      const posts = await Post.find({
        user: { $in: followingIds },
        isArchived: false,
        isDeleted: false
      })
        .populate('user', 'username fullName avatar')
        .populate('likes', 'username')
        .sort({ createdAt: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)
        .lean()

      // Preparar respuesta paginada
      const total = await Post.countDocuments({
        user: { $in: followingIds },
        isArchived: false,
        isDeleted: false
      })

      const response = this.createPaginatedResponse(posts, paginationOptions, total)

      // Cachear resultado
      await cache.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      return PostController.success(res, response, 'Feed obtenido exitosamente')

    } catch (error) {
      logger.error('Error obteniendo feed:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Obtener post por ID
   */
  async getPostById(req, res) {
    try {
      const { id } = req.params

      // Verificar ObjectId
      if (!this.validateObjectId(id)) {
        return PostController.error(res, 'ID de publicación inválido', 400)
      }

      const post = await Post.findById(id)
        .populate('user', 'username fullName avatar')
        .populate('likes', 'username')
        .populate('comments.user', 'username fullName avatar')

      if (!post) {
        return PostController.error(res, 'Publicación no encontrada', 404)
      }

      return PostController.success(res, post, 'Publicación obtenida exitosamente')

    } catch (error) {
      logger.error('Error obteniendo post:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Actualizar publicación
   */
  async updatePost(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { id } = req.params
      const { userId } = req
      const updates = req.body

      // Verificar ObjectId
      if (!this.validateObjectId(id)) {
        return PostController.error(res, 'ID de publicación inválido', 400)
      }

      // Verificar que el post existe y pertenece al usuario
      const ownershipError = await this.validateOwnership(Post, id, userId, res)
      if (ownershipError) {
        return ownershipError
      }

      // Campos permitidos para actualización
      const allowedFields = ['caption', 'location']
      const filteredUpdates = {}

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field]?.trim() || ''
        }
      }

      const post = await Post.findByIdAndUpdate(
        id,
        filteredUpdates,
        { new: true, runValidators: true }
      ).populate('user', 'username fullName avatar')

      // Limpiar cache
      await cache.del(`post:${id}`)
      await cache.del('feed:*')

      logger.info('Post actualizado exitosamente', { postId: id, userId })

      return PostController.success(res, post, 'Publicación actualizada exitosamente')

    } catch (error) {
      logger.error('Error actualizando post:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Eliminar publicación
   */
  async deletePost(req, res) {
    try {
      const { id } = req.params
      const { userId } = req

      // Verificar ObjectId
      if (!this.validateObjectId(id)) {
        return PostController.error(res, 'ID de publicación inválido', 400)
      }

      // Verificar que el post existe y pertenece al usuario
      const ownershipError = await this.validateOwnership(Post, id, userId, res)
      if (ownershipError) {
        return ownershipError
      }

      // Soft delete
      await Post.findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date()
      })

      // Limpiar cache
      await cache.del(`post:${id}`)
      await cache.del('feed:*')
      await cache.del(`user:${userId}:posts`)

      logger.info('Post eliminado exitosamente', { postId: id, userId })

      return PostController.success(res, null, 'Publicación eliminada exitosamente')

    } catch (error) {
      logger.error('Error eliminando post:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Like/Unlike de publicación
   */
  async toggleLike(req, res) {
    try {
      const { id } = req.params
      const { userId } = req

      // Verificar ObjectId
      if (!this.validateObjectId(id)) {
        return PostController.error(res, 'ID de publicación inválido', 400)
      }

      const post = await Post.findById(id)
      if (!post) {
        return PostController.error(res, 'Publicación no encontrada', 404)
      }

      const isLiked = post.likes.includes(userId)

      if (isLiked) {
        // Unlike
        post.likes.pull(userId)
      } else {
        // Like
        post.likes.push(userId)
      }

      await post.save()

      // Crear notificación si es like
      if (!isLiked && post.user.toString() !== userId) {
        await Notification.create({
          user: post.user,
          type: 'like',
          fromUser: userId,
          post: post._id,
          message: 'le gustó tu publicación'
        })
      }

      // Limpiar cache
      await cache.del(`post:${id}`)
      await cache.del('feed:*')

      logger.info(`Post ${isLiked ? 'unliked' : 'liked'} exitosamente`, { postId: id, userId })

      return PostController.success(res, {
        isLiked: !isLiked,
        likesCount: post.likes.length
      }, `Publicación ${isLiked ? 'unliked' : 'liked'} exitosamente`)

    } catch (error) {
      logger.error('Error toggling like:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Obtener posts de un usuario
   */
  async getUserPosts(req, res) {
    try {
      const { userId } = req.params
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar ObjectId
      if (!this.validateObjectId(userId)) {
        return PostController.error(res, 'ID de usuario inválido', 400)
      }

      // Verificar cache
      const cacheKey = `user:${userId}:posts:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedPosts = await cache.get(cacheKey)

      if (cachedPosts) {
        return PostController.success(res, JSON.parse(cachedPosts), 'Posts obtenidos del cache')
      }

      const posts = await Post.find({
        user: userId,
        isArchived: false,
        isDeleted: false
      })
        .populate('user', 'username fullName avatar')
        .populate('likes', 'username')
        .sort({ createdAt: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)
        .lean()

      const total = await Post.countDocuments({
        user: userId,
        isArchived: false,
        isDeleted: false
      })

      const response = this.createPaginatedResponse(posts, paginationOptions, total)

      // Cachear resultado
      await cache.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      return PostController.success(res, response, 'Posts del usuario obtenidos exitosamente')

    } catch (error) {
      logger.error('Error obteniendo posts del usuario:', error)
      return PostController.handleError(res, error)
    }
  }

  /**
   * Crear notificaciones para seguidores cuando se crea un post
   */
  async createPostNotifications(post) {
    try {
      const user = await User.findById(post.user)
      const followers = await User.find({ following: post.user }).select('_id')

      const notifications = followers.map(follower => ({
        user: follower._id,
        type: 'post',
        fromUser: post.user,
        post: post._id,
        message: `${user.username} publicó algo nuevo`
      }))

      if (notifications.length > 0) {
        await Notification.insertMany(notifications)
        logger.info('Notificaciones de post creadas', { postId: post._id, count: notifications.length })
      }
    } catch (error) {
      logger.error('Error creando notificaciones de post:', error)
    }
  }
}

export const postController = new PostController()

// Exportar las validaciones para uso en rutas
export {
  PostController
}
