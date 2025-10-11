import Post from '../models/Post.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import { config } from '../utils/config.js'
import {
  createPaginatedResponse,
  getPaginationOptions,
  getPostPopulateOptions
} from '../utils/queryOptimizer.js'

// Crear una nueva publicación
export const createPost = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { type, caption, location, tags, text } = req.body

    const postData = {
      user: req.userId,
      type: type || 'text',
      caption: caption || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    }

    // Agregar ubicación si se proporciona
    if (location) {
      postData.location = { name: location }
    }

    // Obtener la URL base del servidor desde config (o fallback a request)
    const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`

    // Manejar diferentes tipos de contenido
    switch (type) {
      case 'image': {
        if (!req.files || !req.files.images) {
          return res.status(400).json({
            success: false,
            message: 'La imagen es obligatoria para publicaciones de imagen'
          })
        }

        const images = Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images]
        postData.content = {
          images: images.map(file => ({
            url: `${baseUrl}/uploads/${file.filename}`,
            alt: caption || '',
            width: 0,
            height: 0
          }))
        }
        break
      }

      case 'video':
        if (!req.files || !req.files.video) {
          return res.status(400).json({
            success: false,
            message: 'El video es obligatorio para publicaciones de video'
          })
        }

        postData.content = {
          video: {
            url: `${baseUrl}/uploads/${req.files.video[0].filename}`,
            duration: 0,
            thumbnail: `${baseUrl}/uploads/${req.files.video[0].filename.replace(/\.[^/.]+$/, '_thumb.jpg')}`,
            width: 0,
            height: 0
          }
        }
        break

      case 'text':
        if (!text) {
          return res.status(400).json({
            success: false,
            message: 'El texto es obligatorio para publicaciones de texto'
          })
        }

        postData.content = {
          text
        }
        break

      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de publicación no válido'
        })
    }

    const post = new Post(postData)
    await post.save()

    // Actualizar el array de posts del usuario
    await User.findByIdAndUpdate(req.userId, { $push: { posts: post._id } })

    // Populate user data for response
    await post.populate('user', 'username avatar fullName')

    res.status(201).json({
      success: true,
      message: 'Publicación creada exitosamente',
      post
    })
  } catch (error) {
    logger.error('Error en createPost:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Obtener el feed de publicaciones
export const getFeed = async (req, res) => {
  try {
    const { userId } = req
    const { page, limit, skip } = getPaginationOptions(
      req.query.page,
      req.query.limit
    )

    // Implementar caché para mejorar rendimiento
    const cacheKey = `feed:${userId}:${page}:${limit}`
    logger.debug('Cache key generado para feed:', { cacheKey })

    // Intentar obtener del caché
    const cachedFeed = await cache.get(cacheKey)
    if (cachedFeed) {
      logger.debug(`Feed servido desde caché para usuario ${userId}`)
      return res.json(cachedFeed)
    }

    const user = await User.findById(userId).select('following').lean()

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Usuarios a mostrar: seguidos + propio usuario
    const usersToShow = [userId, ...(user.following || [])]

    // Query optimizada con índices
    const query = {
      user: { $in: usersToShow },
      isPublic: true,
      isArchived: false,
      isDeleted: false
    }

    // Obtener opciones de población optimizadas
    const populateOptions = getPostPopulateOptions()

    // Ejecutar queries en paralelo para mejor performance
    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('user', populateOptions.userFields)
        .populate('comments', populateOptions.commentFields)
        .select('-__v') // Excluir campo de versión
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Convertir a objeto plano para mejor performance
      Post.countDocuments(query)
    ])

    // Agregar campo isLiked para el usuario actual
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes?.includes(userId) || false
    }))

    const response = createPaginatedResponse(
      postsWithLikeStatus,
      total,
      page,
      limit
    )

    // Guardar en caché por 2 minutos
    await cache.set(cacheKey, response, 120)

    res.json(response)
  } catch (error) {
    logger.error('Error en getFeed:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener un post específico
export const getPost = async (req, res) => {
  try {
    const postId = req.params.id
    const { userId } = req

    // Implementar caché para posts individuales
    const cacheKey = `post:${postId}:${userId}`
    logger.info('Cache key generado para post individual:', { cacheKey })

    // Intentar obtener del caché
    const cachedPost = await cache.get(cacheKey)
    if (cachedPost) {
      return res.json(cachedPost)
    }

    // Obtener opciones de población optimizadas
    const populateOptions = getPostPopulateOptions()

    const post = await Post.findOne({
      _id: postId,
      isDeleted: false
    })
      .populate('user', populateOptions.userFields)
      .populate('comments.user', populateOptions.userFields)
      .select('-__v')
      .lean()

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    // Incrementar vistas (sin esperar)
    Post.findByIdAndUpdate(postId, { $inc: { views: 1 } }).exec()

    // Agregar isLiked
    const postWithLikeStatus = {
      ...post,
      isLiked: post.likes?.includes(userId) || false
    }

    const response = {
      success: true,
      post: postWithLikeStatus
    }

    // Guardar en caché por 1 minuto
    await cache.set(cacheKey, response, 60)

    res.json(response)
  } catch (error) {
    logger.error('Error en getPost:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Dar/quitar like a un post
export const toggleLike = async (req, res) => {
  try {
    const postId = req.params.id
    const { userId } = req

    const post = await Post.findById(postId)

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    const isLiked = post.isLikedBy(userId)

    if (isLiked) {
      await post.removeLike(userId)
    } else {
      await post.addLike(userId)

      // Notificar al dueño del post si no es el mismo usuario
      if (post.user.toString() !== userId) {
        await Notification.create({
          user: post.user,
          type: 'like',
          from: userId,
          post: post._id,
          title: 'Nuevo me gusta',
          message: 'Le ha gustado tu publicación'
        })
      }
    }

    // Invalidar caché relacionado con este post
    await cache.deletePattern(`post:${postId}:*`)
    await cache.deletePattern('feed:*')

    // Recargar el post para obtener los datos actualizados
    const updatedPost = await Post.findById(postId)

    res.json({
      success: true,
      liked: !isLiked,
      likesCount: updatedPost.likes.length
    })
  } catch (error) {
    logger.error('Error en toggleLike:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message || error.toString()
    })
  }
}

// Listar usuarios que han dado like a un post
export const getLikes = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      'likes',
      'username avatar fullName'
    )

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    res.json({
      success: true,
      likes: post.likes
    })
  } catch (error) {
    logger.error('Error en getLikes:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener posts de un usuario específico
export const getUserPosts = async (req, res) => {
  try {
    const { username } = req.params
    logger.debug('getUserPosts - Buscando usuario:', { username, params: req.params })

    // Buscar usuario case-insensitive con regex
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    })

    logger.debug('getUserPosts - Resultado búsqueda:', { found: !!user, username: user?.username })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const posts = await Post.findByUser(user._id, { includeArchived: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Post.countDocuments({
      user: user._id,
      isDeleted: false,
      isArchived: false
    })

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getUserPosts:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener posts trending con score ponderado y decaimiento temporal
export const getTrendingPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10

    // Pipeline de agregación para calcular score
    const pipeline = [
      {
        $match: {
          isPublic: true,
          isArchived: false,
          isDeleted: false
        }
      },
      // Contadores y score base
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          commentsCount: { $size: { $ifNull: ['$comments', []] } },
          sharesCount: { $ifNull: ['$shares', 0] },
          viewsCount: { $ifNull: ['$views', 0] }
        }
      },
      {
        $addFields: {
          baseScore: {
            $add: [
              { $multiply: [3, '$likesCount'] },
              { $multiply: [2, '$commentsCount'] },
              { $multiply: [1, '$sharesCount'] },
              { $multiply: [0.2, '$viewsCount'] }
            ]
          }
        }
      },
      // Decaimiento temporal: dividir por (1 + horas/12)
      {
        $addFields: {
          ageHours: {
            $dateDiff: {
              startDate: '$createdAt',
              endDate: '$$NOW',
              unit: 'hour'
            }
          }
        }
      },
      {
        $addFields: {
          score: {
            $cond: [
              { $gt: ['$baseScore', 0] },
              {
                $divide: [
                  '$baseScore',
                  { $add: [1, { $divide: ['$ageHours', 12] }] }
                ]
              },
              0
            ]
          }
        }
      },
      // Priorizar últimos 7 días pero sin excluir antiguos (ligero bonus)
      {
        $addFields: {
          isRecent: {
            $gte: [
              '$createdAt',
              { $dateSubtract: { startDate: '$$NOW', unit: 'day', amount: 7 } }
            ]
          }
        }
      },
      {
        $addFields: {
          boostedScore: {
            $cond: ['$isRecent', { $add: ['$score', 1] }, '$score']
          }
        }
      },
      { $sort: { boostedScore: -1, createdAt: -1 } },
      { $limit: limit },
      // Poblar datos básicos del usuario
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          user: {
            _id: '$user._id',
            username: '$user.username',
            avatar: '$user.avatar',
            fullName: '$user.fullName'
          },
          type: 1,
          content: 1,
          caption: 1,
          likes: 1,
          comments: 1,
          views: 1,
          shares: 1,
          isPublic: 1,
          isArchived: 1,
          isDeleted: 1,
          createdAt: 1,
          updatedAt: 1,
          // métricas calculadas (por si queremos depurar)
          likesCount: 1,
          commentsCount: 1,
          boostedScore: 1
        }
      }
    ]

    const posts = await Post.aggregate(pipeline)

    res.json({ success: true, posts })
  } catch (error) {
    logger.error('Error en getTrendingPosts:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar un post
export const deletePost = async (req, res) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      })
    }

    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    // Verificar que el usuario sea el dueño del post
    // Convertir ambos a string para comparación segura
    const postUserId = post.user.toString()
    const requestUserId = req.userId.toString()

    if (postUserId !== requestUserId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta publicación'
      })
    }

    await post.softDelete()

    res.json({
      success: true,
      message: 'Publicación eliminada exitosamente'
    })
  } catch (error) {
    logger.error('Error en deletePost:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar un post
export const updatePost = async (req, res) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      })
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { caption, location, tags } = req.body
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    // Verificar que el usuario sea el dueño del post
    // Convertir ambos a string para comparación segura
    const postUserId = post.user.toString()
    const requestUserId = req.userId.toString()

    if (postUserId !== requestUserId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar esta publicación'
      })
    }

    // Actualizar campos permitidos
    if (caption !== undefined) { post.caption = caption }
    if (location !== undefined) { post.location = { name: location } }
    if (tags !== undefined) { post.tags = tags.split(',').map(tag => tag.trim()) }

    await post.save()

    res.json({
      success: true,
      message: 'Publicación actualizada exitosamente',
      post
    })
  } catch (error) {
    logger.error('Error en updatePost:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener posts recientes (públicos)
export const getRecentPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const posts = await Post.find({
      isPublic: true,
      isDeleted: false
    })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Post.countDocuments({
      isPublic: true,
      isDeleted: false
    })

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getRecentPosts:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Alias para compatibilidad con rutas
export const likePost = toggleLike
export const unlikePost = toggleLike

export default {
  createPost,
  getFeed,
  getPost,
  toggleLike,
  likePost,
  unlikePost,
  getLikes,
  getUserPosts,
  getTrendingPosts,
  deletePost,
  updatePost,
  getRecentPosts
}

