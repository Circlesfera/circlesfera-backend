import asyncHandler from 'express-async-handler'
import Post from '../models/Post.js'
import cacheManager from '../infrastructure/cache/CacheManager.js'
import queryOptimizer from '../infrastructure/performance/QueryOptimizer.js'
import responseOptimizer from '../infrastructure/performance/ResponseOptimizer.js'
import { Cacheable, CacheInvalidate, CacheKeys, InvalidationPatterns } from '../infrastructure/cache/CacheDecorator.js'
import logger from '../utils/logger.js'

/**
 * Controlador optimizado para posts con caché y performance mejorada
 */
class OptimizedPostController {
  constructor() {
    this.postService = new PostService()
  }

  /**
   * Obtener feed de posts con caché inteligente
   */
  @Cacheable({
    type: 'feed',
    keyGenerator: (req) => CacheKeys.feed(req.user.id, req.query.page || 1, req.query.limit || 20),
    ttl: 180, // 3 minutos
  })
  getFeed = asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

    try {
      // Optimizar consulta
      const optimizedQuery = queryOptimizer.optimizeFind({
        isArchived: false,
        isDeleted: false,
      }, {
        addSelect: true,
        addSort: true,
        addLimit: true,
        defaultLimit: parseInt(limit),
        maxLimit: 100
      })

      // Aplicar paginación
      const skip = (parseInt(page) - 1) * parseInt(limit)

      // Ejecutar consulta optimizada
      const posts = await Post.find(optimizedQuery)
        .populate('userId', 'username avatar fullName')
        .populate('likes', 'userId')
        .populate('comments', 'userId content createdAt')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery(optimizedQuery, executionTime, 'posts')

      // Optimizar respuesta
      const optimizedResponse = responseOptimizer.optimizeListResponse(posts, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
      })

      // Agregar metadatos de performance
      optimizedResponse.meta.performance = {
        queryTime: executionTime,
        cacheHit: res.locals.cacheHit || false,
        optimized: true
      }

      res.json(optimizedResponse)

    } catch (error) {
      logger.error('Error en getFeed:', error)
      res.status(500).json({
        success: false,
        message: 'Error obteniendo feed de posts',
        code: 'FEED_ERROR'
      })
    }
  })

  /**
   * Obtener post individual con caché
   */
  @Cacheable({
    type: 'post',
    keyGenerator: (req) => CacheKeys.post(req.params.id),
    ttl: 600, // 10 minutos
  })
  getPost = asyncHandler(async (req, res) => {
    const startTime = Date.now()

    try {
      const post = await Post.findById(req.params.id)
        .populate('userId', 'username avatar fullName')
        .populate('likes', 'userId')
        .populate({
          path: 'comments',
          populate: {
            path: 'userId',
            select: 'username avatar'
          }
        })
        .lean()

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post no encontrado',
          code: 'POST_NOT_FOUND'
        })
      }

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery({ _id: req.params.id }, executionTime, 'posts')

      // Optimizar respuesta
      const optimizedResponse = responseOptimizer.optimizeResponse(post, {
        processingTime: executionTime,
        cacheHit: res.locals.cacheHit || false
      })

      res.json(optimizedResponse)

    } catch (error) {
      logger.error('Error en getPost:', error)
      res.status(500).json({
        success: false,
        message: 'Error obteniendo post',
        code: 'POST_ERROR'
      })
    }
  })

  /**
   * Crear post con invalidación de caché
   */
  @CacheInvalidate({
    patterns: [
      InvalidationPatterns.userFeed(req.user.id),
      InvalidationPatterns.allFeeds(),
      InvalidationPatterns.userPosts(req.user.id)
    ],
    type: 'feed'
  })
  createPost = asyncHandler(async (req, res) => {
    const startTime = Date.now()

    try {
      const postData = {
        ...req.body,
        userId: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const post = new Post(postData)
      await post.save()

      // Enriquecer con datos del usuario
      await post.populate('userId', 'username avatar fullName')

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery(postData, executionTime, 'posts')

      // Optimizar respuesta
      const optimizedResponse = responseOptimizer.optimizeResponse(post, {
        processingTime: executionTime,
        compressed: true
      })

      res.status(201).json(optimizedResponse)

    } catch (error) {
      logger.error('Error en createPost:', error)
      res.status(500).json({
        success: false,
        message: 'Error creando post',
        code: 'CREATE_POST_ERROR'
      })
    }
  })

  /**
   * Actualizar post con invalidación de caché
   */
  @CacheInvalidate({
    patterns: [
      (req) => InvalidationPatterns.postRelated(req.params.id),
      (req) => InvalidationPatterns.userPosts(req.user.id),
      InvalidationPatterns.allFeeds()
    ],
    type: 'post'
  })
  updatePost = asyncHandler(async (req, res) => {
    const startTime = Date.now()

    try {
      const post = await Post.findById(req.params.id)

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post no encontrado',
          code: 'POST_NOT_FOUND'
        })
      }

      // Verificar autorización
      if (post.userId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para editar este post',
          code: 'UNAUTHORIZED'
        })
      }

      // Actualizar post
      Object.assign(post, req.body, { updatedAt: new Date() })
      await post.save()

      // Enriquecer con datos del usuario
      await post.populate('userId', 'username avatar fullName')

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery({ _id: req.params.id }, executionTime, 'posts')

      // Optimizar respuesta
      const optimizedResponse = responseOptimizer.optimizeResponse(post, {
        processingTime: executionTime,
        compressed: true
      })

      res.json(optimizedResponse)

    } catch (error) {
      logger.error('Error en updatePost:', error)
      res.status(500).json({
        success: false,
        message: 'Error actualizando post',
        code: 'UPDATE_POST_ERROR'
      })
    }
  })

  /**
   * Eliminar post con invalidación de caché
   */
  @CacheInvalidate({
    patterns: [
      (req) => InvalidationPatterns.postRelated(req.params.id),
      (req) => InvalidationPatterns.userPosts(req.user.id),
      InvalidationPatterns.allFeeds()
    ],
    type: 'post'
  })
  deletePost = asyncHandler(async (req, res) => {
    const startTime = Date.now()

    try {
      const post = await Post.findById(req.params.id)

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post no encontrado',
          code: 'POST_NOT_FOUND'
        })
      }

      // Verificar autorización
      if (post.userId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No autorizado para eliminar este post',
          code: 'UNAUTHORIZED'
        })
      }

      // Eliminar post
      await Post.findByIdAndDelete(req.params.id)

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery({ _id: req.params.id }, executionTime, 'posts')

      res.json({
        success: true,
        message: 'Post eliminado exitosamente',
        meta: {
          processingTime: executionTime,
          deletedPostId: req.params.id
        }
      })

    } catch (error) {
      logger.error('Error en deletePost:', error)
      res.status(500).json({
        success: false,
        message: 'Error eliminando post',
        code: 'DELETE_POST_ERROR'
      })
    }
  })

  /**
   * Buscar posts con caché y optimización
   */
  @Cacheable({
    type: 'search',
    keyGenerator: (req) => CacheKeys.search(req.query.q, req.query),
    ttl: 60, // 1 minuto
  })
  searchPosts = asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { q: query, page = 1, limit = 20 } = req.query

    try {
      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query de búsqueda requerida',
          code: 'SEARCH_QUERY_REQUIRED'
        })
      }

      // Crear pipeline de agregación optimizado
      const pipeline = queryOptimizer.optimizeAggregation([
        {
          $match: {
            $or: [
              { caption: { $regex: query, $options: 'i' } },
              { tags: { $in: [new RegExp(query, 'i')] } }
            ],
            isArchived: false,
            isDeleted: false
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { username: 1, avatar: 1, fullName: 1 } }
            ]
          }
        },
        {
          $unwind: '$user'
        },
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'postId',
            as: 'likes'
          }
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'postId',
            as: 'comments'
          }
        },
        {
          $addFields: {
            likesCount: { $size: '$likes' },
            commentsCount: { $size: '$comments' }
          }
        }
      ], {
        addIndexHints: true,
        addProjection: true,
        optimizeSort: true
      })

      // Aplicar paginación
      const skip = (parseInt(page) - 1) * parseInt(limit)
      pipeline.push({ $skip: skip })
      pipeline.push({ $limit: parseInt(limit) })

      const posts = await Post.aggregate(pipeline)

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery(pipeline, executionTime, 'posts')

      // Optimizar respuesta de búsqueda
      const optimizedResponse = responseOptimizer.optimizeSearchResponse(posts, query, {
        page: parseInt(page),
        limit: parseInt(limit),
        highlight: true,
        facets: false
      })

      // Agregar metadatos de performance
      optimizedResponse.meta.performance = {
        queryTime: executionTime,
        cacheHit: res.locals.cacheHit || false,
        aggregationPipeline: true
      }

      res.json(optimizedResponse)

    } catch (error) {
      logger.error('Error en searchPosts:', error)
      res.status(500).json({
        success: false,
        message: 'Error buscando posts',
        code: 'SEARCH_ERROR'
      })
    }
  })

  /**
   * Obtener posts trending con caché
   */
  @Cacheable({
    type: 'trending',
    keyGenerator: (req) => CacheKeys.trending('posts', req.query.period || 'daily'),
    ttl: 300, // 5 minutos
  })
  getTrendingPosts = asyncHandler(async (req, res) => {
    const startTime = Date.now()
    const { period = 'daily', limit = 50 } = req.query

    try {
      // Calcular fecha de inicio basada en el período
      const now = new Date()
      let startDate

      switch (period) {
        case 'hourly':
          startDate = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case 'daily':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      // Pipeline de agregación para posts trending
      const pipeline = queryOptimizer.optimizeAggregation([
        {
          $match: {
            createdAt: { $gte: startDate },
            isArchived: false,
            isDeleted: false
          }
        },
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'postId',
            as: 'likes'
          }
        },
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'postId',
            as: 'comments'
          }
        },
        {
          $addFields: {
            likesCount: { $size: '$likes' },
            commentsCount: { $size: '$comments' },
            engagementScore: {
              $add: [
                { $size: '$likes' },
                { $multiply: [{ $size: '$comments' }, 2] } // Comentarios valen más
              ]
            }
          }
        },
        {
          $sort: { engagementScore: -1, createdAt: -1 }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { username: 1, avatar: 1, fullName: 1 } }
            ]
          }
        },
        {
          $unwind: '$user'
        }
      ])

      pipeline.push({ $limit: parseInt(limit) })

      const trendingPosts = await Post.aggregate(pipeline)

      // Analizar query performance
      const executionTime = Date.now() - startTime
      queryOptimizer.analyzeSlowQuery(pipeline, executionTime, 'posts')

      // Optimizar respuesta
      const optimizedResponse = responseOptimizer.optimizeResponse(trendingPosts, {
        processingTime: executionTime,
        cacheHit: res.locals.cacheHit || false,
        includeMeta: true
      })

      // Agregar metadatos específicos de trending
      optimizedResponse.meta.trending = {
        period,
        startDate: startDate.toISOString(),
        totalPosts: trendingPosts.length
      }

      res.json(optimizedResponse)

    } catch (error) {
      logger.error('Error en getTrendingPosts:', error)
      res.status(500).json({
        success: false,
        message: 'Error obteniendo posts trending',
        code: 'TRENDING_ERROR'
      })
    }
  })

  /**
   * Obtener estadísticas de performance
   */
  getPerformanceStats = asyncHandler(async (req, res) => {
    try {
      const cacheStats = await cacheManager.getStats()
      const queryStats = queryOptimizer.getQueryStats()
      const indexSuggestions = queryOptimizer.suggestIndexes()

      res.json({
        success: true,
        data: {
          cache: cacheStats,
          queries: queryStats,
          indexSuggestions,
          timestamp: new Date().toISOString()
        }
      })

    } catch (error) {
      logger.error('Error obteniendo estadísticas de performance:', error)
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas',
        code: 'STATS_ERROR'
      })
    }
  })
}

// Crear instancia del controlador
const optimizedPostController = new OptimizedPostController()

export default optimizedPostController
