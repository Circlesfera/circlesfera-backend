/**
 * 🚀 OPTIMIZED POST CONTROLLER
 * ============================
 * Controlador de posts optimizado con caching avanzado y performance monitoring
 */

import BaseController from './BaseController.js'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import logger from '../utils/logger.js'
import cacheService from '../services/cacheService.js'
import { config } from '../utils/config.js'
import { body } from 'express-validator'

class OptimizedPostController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para crear post
  static createPostValidations = [
    body('type')
      .isIn(['image', 'video'])
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
    body('content')
      .isObject()
      .withMessage('El contenido es requerido'),
    body('content.images')
      .if(body('type').equals('image'))
      .isArray({ min: 1 })
      .withMessage('Las publicaciones de imagen deben tener al menos una imagen'),
    body('content.video')
      .if(body('type').equals('video'))
      .isObject()
      .withMessage('Las publicaciones de video deben tener un video')
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
      .withMessage('La ubicación no puede exceder los 100 caracteres'),
    body('tags')
      .optional()
      .isString()
      .trim()
      .withMessage('Los tags deben ser una cadena de texto')
  ]

  /**
   * Crear nuevo post con caching optimizado
   */
  createPost = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { type, caption, content, location, tags } = req.body
    const userId = req.user.id

    // Validar que el usuario existe (con cache)
    const user = await cacheService.getUser(userId, () =>
      User.findById(userId).select('username fullName avatar')
    )

    if (!user) {
      return this.errorResponse(res, 'Usuario no encontrado', 404)
    }

    // Procesar tags
    const processedTags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []

    // Crear post
    const postData = {
      user: userId,
      type,
      caption: caption || '',
      content,
      location: location ? { name: location } : undefined,
      tags: processedTags,
      likes: [],
      comments: [],
      views: 0,
      shares: 0,
      isPublic: true,
      isArchived: false,
      isDeleted: false
    }

    const post = new Post(postData)
    await post.save()

    // Poblar datos del usuario
    await post.populate('user', 'username fullName avatar')

    // Invalidar caches relacionados
    await cacheService.invalidateUser(userId)
    await cacheService.invalidateFeed()
    await cacheService.invalidateTrending()

    // Crear notificación para seguidores (en background)
    this.notifyFollowersNewPost(user, post).catch(error => {
      logger.error('Error notificando seguidores:', error)
    })

    const responseTime = Date.now() - startTime
    logger.info('Post created', {
      postId: post._id,
      userId,
      type,
      responseTime,
      tagsCount: processedTags.length
    })

    this.successResponse(res, post, 'Post creado exitosamente', 201)
  })

  /**
   * Obtener feed optimizado con caching inteligente
   */
  getFeed = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const userId = req.user.id
    const { page = 1, limit = 20, type } = req.query
    const skip = (page - 1) * limit

    const filters = { page: parseInt(page), limit: parseInt(limit) }
    if (type) {
      filters.type = type
    }

    // Obtener feed con cache
    const feed = await cacheService.getFeed(userId, filters, async () => {
      // Obtener usuarios seguidos
      const user = await User.findById(userId).populate('following', '_id')
      const followingIds = user.following.map(f => f._id)
      followingIds.push(userId) // Incluir posts propios

      // Query optimizada con índices
      const query = {
        user: { $in: followingIds },
        isPublic: true,
        isArchived: false,
        isDeleted: false
      }

      if (type) {
        query.type = type
      }

      const posts = await Post.find(query)
        .populate('user', 'username fullName avatar isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean() // Usar lean() para mejor performance

      // Enriquecer con datos de engagement
      return posts.map(post => ({
        ...post,
        likesCount: post.likes.length,
        commentsCount: post.comments.length,
        isLiked: post.likes.includes(userId)
      }))
    })

    const responseTime = Date.now() - startTime
    logger.info('Feed retrieved', {
      userId,
      postsCount: feed.length,
      page,
      responseTime
    })

    this.successResponse(res, {
      posts: feed,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: feed.length === parseInt(limit)
      }
    })
  })

  /**
   * Obtener post por ID con cache
   */
  getPostById = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { id } = req.params
    const userId = req.user?.id

    const post = await cacheService.getPost(id, () =>
      Post.findOne({
        _id: id,
        isDeleted: false
      })
        .populate('user', 'username fullName avatar isVerified')
        .populate({
          path: 'comments',
          populate: {
            path: 'user',
            select: 'username fullName avatar'
          },
          options: { sort: { createdAt: -1 }, limit: 10 }
        })
        .lean()
    )

    if (!post) {
      return this.errorResponse(res, 'Post no encontrado', 404)
    }

    // Incrementar vistas (en background)
    this.incrementViews(id).catch(error => {
      logger.error('Error incrementing views:', error)
    })

    // Enriquecer con datos del usuario actual
    const enrichedPost = {
      ...post,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      isLiked: userId ? post.likes.includes(userId) : false
    }

    const responseTime = Date.now() - startTime
    logger.info('Post retrieved', {
      postId: id,
      userId,
      responseTime
    })

    this.successResponse(res, enrichedPost)
  })

  /**
   * Obtener posts de usuario con cache
   */
  getUserPosts = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { username } = req.params
    const { page = 1, limit = 20, type } = req.query
    const skip = (page - 1) * limit

    // Obtener usuario por username
    const user = await cacheService.getUser(`username:${username}`, () =>
      User.findOne({ username }).select('_id username fullName avatar')
    )

    if (!user) {
      return this.errorResponse(res, 'Usuario no encontrado', 404)
    }

    const filters = { page: parseInt(page), limit: parseInt(limit) }
    if (type) {
      filters.type = type
    }

    const posts = await cacheService.getOrSet(
      `user:posts:${user._id}:${JSON.stringify(filters)}`,
      async () => {
        const query = {
          user: user._id,
          isPublic: true,
          isArchived: false,
          isDeleted: false
        }

        if (type) {
          query.type = type
        }

        return Post.find(query)
          .populate('user', 'username fullName avatar isVerified')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean()
      },
      300 // 5 minutos de cache
    )

    const responseTime = Date.now() - startTime
    logger.info('User posts retrieved', {
      username,
      postsCount: posts.length,
      page,
      responseTime
    })

    this.successResponse(res, {
      user,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: posts.length === parseInt(limit)
      }
    })
  })

  /**
   * Obtener posts trending con cache
   */
  getTrendingPosts = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { limit = 20, period = '24h' } = req.query

    const filters = { limit: parseInt(limit), period }

    const trendingPosts = await cacheService.getTrending(filters, async () => {
      const timeFilter = this.getTimeFilter(period)

      return Post.find({
        ...timeFilter,
        isPublic: true,
        isArchived: false,
        isDeleted: false
      })
        .populate('user', 'username fullName avatar isVerified')
        .sort({
          engagement: -1, // Virtual field que combina likes, comments y shares
          createdAt: -1
        })
        .limit(parseInt(limit))
        .lean()
    })

    const responseTime = Date.now() - startTime
    logger.info('Trending posts retrieved', {
      postsCount: trendingPosts.length,
      period,
      responseTime
    })

    this.successResponse(res, trendingPosts)
  })

  /**
   * Toggle like con cache
   */
  toggleLike = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { id } = req.params
    const userId = req.user.id

    const post = await Post.findById(id)
    if (!post) {
      return this.errorResponse(res, 'Post no encontrado', 404)
    }

    const isLiked = post.isLikedBy(userId)

    if (isLiked) {
      await post.removeLike(userId)
    } else {
      await post.addLike(userId)
    }

    // Invalidar caches relacionados
    await cacheService.invalidatePost(id, userId)
    await cacheService.invalidateTrending()

    const responseTime = Date.now() - startTime
    logger.info('Like toggled', {
      postId: id,
      userId,
      action: isLiked ? 'unliked' : 'liked',
      responseTime
    })

    this.successResponse(res, {
      isLiked: !isLiked,
      likesCount: post.likes.length
    })
  })

  /**
   * Actualizar post
   */
  updatePost = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { id } = req.params
    const userId = req.user.id
    const { caption, location, tags } = req.body

    const post = await Post.findOne({
      _id: id,
      user: userId,
      isDeleted: false
    })

    if (!post) {
      return this.errorResponse(res, 'Post no encontrado', 404)
    }

    // Actualizar campos
    if (caption !== undefined) {
      post.caption = caption
    }
    if (location !== undefined) {
      post.location = location ? { name: location } : undefined
    }
    if (tags !== undefined) {
      post.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
    }

    await post.save()

    // Invalidar caches
    await cacheService.invalidatePost(id, userId)

    const responseTime = Date.now() - startTime
    logger.info('Post updated', {
      postId: id,
      userId,
      responseTime
    })

    this.successResponse(res, post, 'Post actualizado exitosamente')
  })

  /**
   * Eliminar post
   */
  deletePost = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { id } = req.params
    const userId = req.user.id

    const post = await Post.findOne({
      _id: id,
      user: userId,
      isDeleted: false
    })

    if (!post) {
      return this.errorResponse(res, 'Post no encontrado', 404)
    }

    // Soft delete
    await post.softDelete()

    // Invalidar caches
    await cacheService.invalidatePost(id, userId)
    await cacheService.invalidateFeed()
    await cacheService.invalidateTrending()

    const responseTime = Date.now() - startTime
    logger.info('Post deleted', {
      postId: id,
      userId,
      responseTime
    })

    this.successResponse(res, null, 'Post eliminado exitosamente')
  })

  /**
   * Buscar posts
   */
  searchPosts = this.asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { q, type, limit = 20 } = req.query

    if (!q || q.trim().length < 2) {
      return this.errorResponse(res, 'Query de búsqueda debe tener al menos 2 caracteres', 400)
    }

    const filters = { q: q.trim(), type, limit: parseInt(limit) }

    const results = await cacheService.getOrSet(
      `search:posts:${JSON.stringify(filters)}`,
      async () => {
        const query = {
          $and: [
            { isPublic: true, isArchived: false, isDeleted: false },
            {
              $or: [
                { caption: { $regex: q.trim(), $options: 'i' } },
                { tags: { $in: [new RegExp(q.trim(), 'i')] } }
              ]
            }
          ]
        }

        if (type) {
          query.type = type
        }

        return Post.find(query)
          .populate('user', 'username fullName avatar isVerified')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .lean()
      },
      180 // 3 minutos de cache
    )

    const responseTime = Date.now() - startTime
    logger.info('Posts searched', {
      query: q,
      resultsCount: results.length,
      responseTime
    })

    this.successResponse(res, results)
  })

  // Métodos auxiliares privados

  /**
   * Obtener filtro de tiempo para trending
   */
  getTimeFilter(period) {
    const now = new Date()
    let timeAgo

    switch (period) {
      case '1h':
        timeAgo = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        timeAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        timeAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        timeAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    return { createdAt: { $gte: timeAgo } }
  }

  /**
   * Incrementar vistas en background
   */
  async incrementViews(postId) {
    await Post.findByIdAndUpdate(postId, { $inc: { views: 1 } })
  }

  /**
   * Notificar seguidores en background
   */
  async notifyFollowersNewPost(user, post) {
    const followers = await User.find({ following: user._id }).select('_id')

    const notifications = followers.map(follower => ({
      user: follower._id,
      type: 'new_post',
      data: {
        postId: post._id,
        authorId: user._id,
        authorUsername: user.username,
        postType: post.type
      },
      message: `${user.username} compartió una nueva publicación`
    }))

    if (notifications.length > 0) {
      await Notification.insertMany(notifications)
    }
  }
}

// Crear instancia
const optimizedPostController = new OptimizedPostController()

export { OptimizedPostController, optimizedPostController }
export default optimizedPostController
