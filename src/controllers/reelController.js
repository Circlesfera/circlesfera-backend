import Reel from '../models/Reel.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import { config } from '../utils/config.js'
import {
  createPaginatedResponse,
  getPaginationOptions,
  USER_BASIC_FIELDS
} from '../utils/queryOptimizer.js'

// Crear un nuevo reel
export const createReel = async (req, res) => {
  try {
    logger.info('🎬 createReel llamado con:', {
      userId: req.userId,
      body: req.body,
      headers: req.headers
    })

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const {
      caption,
      hashtags,
      location,
      audioTitle,
      audioArtist,
      allowComments,
      allowDuets,
      allowStitches
    } = req.body

    // Verificar que se subió un video
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: 'El video es obligatorio para crear un reel'
      })
    }

    // Obtener la URL base del servidor desde config (o fallback a request)
    const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`
    const videoUrl = `${baseUrl}/uploads/${req.files.video[0].filename}`

    // Crear objeto del reel
    const reelData = {
      user: req.userId,
      video: {
        url: videoUrl,
        thumbnail: videoUrl.replace(/\.[^/.]+$/, '_thumb.jpg'), // Thumbnail automático
        duration: 0, // Se calculará después
        width: 1080, // Proporción 9:16 fija
        height: 1920
      },
      caption: caption || '',
      hashtags: hashtags
        ? hashtags.split(',').map(tag => tag.trim().replace('#', ''))
        : [],
      allowComments: allowComments !== false, // Por defecto true
      allowDuets: allowDuets !== false, // Por defecto true
      allowStitches: allowStitches !== false // Por defecto true
    }

    // Agregar audio si se proporciona
    if (audioTitle || audioArtist) {
      reelData.audio = {
        title: audioTitle || '',
        artist: audioArtist || ''
      }
    }

    // Agregar ubicación si se proporciona
    if (location) {
      reelData.location = { name: location }
    }

    logger.info('🎬 Reel data a crear:', reelData)

    // Crear el reel
    const reel = new Reel(reelData)
    await reel.save()

    // Populate user info para la respuesta
    await reel.populate('user', 'username avatar fullName')

    // Crear notificación para seguidores (opcional)
    try {
      const user = await User.findById(req.userId)
      if (user && user.followers && user.followers.length > 0) {
        // Notificar a los primeros 10 seguidores para evitar spam
        const followersToNotify = user.followers.slice(0, 10)
        const notificationsData = followersToNotify.map(followerId => ({
          user: followerId,
          type: 'new_reel',
          fromUser: req.userId,
          content: `${user.username} subió un nuevo reel`,
          relatedContent: {
            type: 'reel',
            id: reel._id
          }
        }))
        if (notificationsData.length > 0) {
          await Notification.insertMany(notificationsData)
        }
      }
    } catch (notifError) {
      logger.info('⚠️ Error creando notificaciones:', notifError)
      // No fallar si las notificaciones fallan
    }

    res.status(201).json({
      success: true,
      message: 'Reel creado exitosamente',
      reel
    })
  } catch (error) {
    logger.error('Error en createReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Obtener reels para el feed
export const getReelsForFeed = async (req, res) => {
  try {
    const { userId } = req
    const { page, limit, skip } = getPaginationOptions(
      req.query.page || 1,
      req.query.limit || 20
    )

    logger.info('Feed de reels solicitado:', { userId, page, limit })

    // Implementar caché para mejorar rendimiento
    const cacheKey = `reels_feed:${page}:${limit}`
    logger.debug('Cache key generado para feed de reels:', { cacheKey })

    // Intentar obtener del caché
    const cachedReels = await cache.get(cacheKey)
    if (cachedReels) {
      logger.info('Feed de reels servido desde caché')
      return res.json(cachedReels)
    }

    // Query optimizada
    const query = {
      isDeleted: false,
      isPublic: true
    }

    // Ejecutar queries en paralelo
    const [reels, total] = await Promise.all([
      Reel.find(query)
        .populate('user', USER_BASIC_FIELDS)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reel.countDocuments(query)
    ])

    const response = createPaginatedResponse({
      data: reels,
      page,
      limit,
      total,
      success: true,
      message: 'Reels obtenidos exitosamente'
    })

    // Guardar en caché por 2 minutos
    await cache.set(cacheKey, response, 120)

    res.json(response)
  } catch (error) {
    logger.error('Error en getReelsForFeed:', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      page: req.query.page,
      limit: req.query.limit
    })
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener reels de un usuario específico
export const getUserReels = async (req, res) => {
  try {
    const { username } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const user = await User.findOne({ username })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const reels = await Reel.find({
      user: user._id,
      isDeleted: false
    })
      .populate('user', 'username avatar fullName')
      .populate('audio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    // Contar total de reels del usuario
    const total = await Reel.countDocuments({
      user: user._id,
      isDeleted: false
    })

    res.json({
      success: true,
      reels,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReels: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    logger.error('Error en getUserReels:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener un reel específico
export const getReel = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req

    const reel = await Reel.findOne({
      _id: id,
      isDeleted: false,
      isPublic: true
    })
      .populate('user', 'username avatar fullName')
      .populate('audio')
      .populate('comments.user', 'username avatar')
      .populate('likes.user', 'username avatar')

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Agregar vista si el usuario no es el dueño
    if (reel.user._id.toString() !== userId) {
      await reel.addView(userId)
    }

    res.json({
      success: true,
      reel
    })
  } catch (error) {
    logger.error('Error en getReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Dar like a un reel
export const likeReel = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req

    const reel = await Reel.findById(id)
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    if (reel.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Verificar si ya dio like
    const existingLike = reel.likes.find(like => like.user.equals(userId))
    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: 'Ya has dado like a este reel'
      })
    }

    await reel.addLike(userId)

    // Invalidar caché relacionado
    await cache.deletePattern(`reel:${id}:*`)
    await cache.deletePattern('reels:feed:*')

    // Crear notificación para el dueño del reel
    if (reel.user.toString() !== userId) {
      try {
        const user = await User.findById(userId)
        await Notification.create({
          user: reel.user,
          type: 'reel_like',
          fromUser: userId,
          content: `A ${user.username} le gustó tu reel`,
          relatedContent: {
            type: 'reel',
            id: reel._id
          }
        })
      } catch (notifError) {
        logger.info('⚠️ Error creando notificación de like:', notifError)
      }
    }

    res.json({
      success: true,
      message: 'Like agregado exitosamente',
      likesCount: reel.likes.length + 1,
      isLiked: true
    })
  } catch (error) {
    logger.error('Error en likeReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Quitar like de un reel
export const unlikeReel = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req

    const reel = await Reel.findById(id)
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    await reel.removeLike(userId)

    // Invalidar caché relacionado
    await cache.deletePattern(`reel:${id}:*`)
    await cache.deletePattern('reels:feed:*')

    res.json({
      success: true,
      message: 'Like removido exitosamente',
      likesCount: reel.likes.length,
      isLiked: false
    })
  } catch (error) {
    logger.error('Error en unlikeReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Comentar un reel
export const commentReel = async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const { userId } = req

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El comentario no puede estar vacío'
      })
    }

    const reel = await Reel.findById(id)
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    if (reel.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    if (!reel.allowComments) {
      return res.status(403).json({
        success: false,
        message: 'Los comentarios están deshabilitados para este reel'
      })
    }

    await reel.addComment(userId, content.trim())

    // Crear notificación para el dueño del reel
    if (reel.user.toString() !== userId) {
      try {
        const user = await User.findById(userId)
        await Notification.create({
          user: reel.user,
          type: 'reel_comment',
          fromUser: userId,
          content: `${user.username} comentó en tu reel`,
          relatedContent: {
            type: 'reel',
            id: reel._id
          }
        })
      } catch (notifError) {
        logger.info('⚠️ Error creando notificación de comentario:', notifError)
      }
    }

    // Obtener el reel actualizado con el comentario
    const updatedReel = await Reel.findById(id)
      .populate('user', 'username avatar fullName')
      .populate('comments.user', 'username avatar')

    res.json({
      success: true,
      message: 'Comentario agregado exitosamente',
      reel: updatedReel,
      commentsCount: updatedReel.comments.length
    })
  } catch (error) {
    logger.error('Error en commentReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar un reel
export const deleteReel = async (req, res) => {
  try {
    const { id } = req.params
    const { userId } = req

    const reel = await Reel.findById(id)
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Verificar que el usuario sea el dueño del reel
    if (reel.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este reel'
      })
    }

    await reel.softDelete()

    res.json({
      success: true,
      message: 'Reel eliminado exitosamente'
    })
  } catch (error) {
    logger.error('Error en deleteReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Buscar reels por hashtag
export const searchReelsByHashtag = async (req, res) => {
  try {
    const { hashtag } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const reels = await Reel.find({
      hashtags: { $regex: hashtag, $options: 'i' },
      isDeleted: false,
      isPublic: true
    })
      .populate('user', 'username avatar fullName')
      .populate('audio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    // Contar total de reels con ese hashtag
    const total = await Reel.countDocuments({
      hashtags: { $regex: hashtag, $options: 'i' },
      isDeleted: false,
      isPublic: true
    })

    res.json({
      success: true,
      reels,
      hashtag,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReels: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    logger.error('Error en searchReelsByHashtag:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener reels trending (más populares)
export const getTrendingReels = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const timeFrame = req.query.timeFrame || 'week' // week, month, all

    let dateFilter = {}
    if (timeFrame === 'week') {
      dateFilter = {
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    } else if (timeFrame === 'month') {
      dateFilter = {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    }

    const reels = await Reel.aggregate([
      { $match: { isDeleted: false, isPublic: true, ...dateFilter } },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$viewsCount', 1] },
              { $multiply: ['$likesCount', 2] },
              { $multiply: ['$commentsCount', 3] },
              { $multiply: ['$sharesCount', 4] }
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit },
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
          'user.password': 0,
          'user.email': 0
        }
      }
    ])

    res.json({
      success: true,
      reels,
      timeFrame
    })
  } catch (error) {
    logger.error('Error en getTrendingReels:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Guardar un reel
export const saveReel = async (req, res) => {
  try {
    const reelId = req.params.id
    const { userId } = req

    // Verificar que el reel existe
    const reel = await Reel.findById(reelId)
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Agregar reel a savedPosts del usuario
    const user = await User.findById(userId)
    if (!user.savedPosts.includes(reelId)) {
      user.savedPosts.push(reelId)
      await user.save()

      logger.info('Reel guardado:', { userId, reelId })

      return res.status(200).json({
        success: true,
        message: 'Reel guardado exitosamente'
      })
    }

    return res.status(400).json({
      success: false,
      message: 'El reel ya está guardado'
    })
  } catch (error) {
    logger.error('Error al guardar reel:', { error: error.message })
    return res.status(500).json({
      success: false,
      message: 'Error al guardar el reel'
    })
  }
}

// Dejar de guardar un reel
export const unsaveReel = async (req, res) => {
  try {
    const reelId = req.params.id
    const { userId } = req

    // Remover reel de savedPosts del usuario
    const user = await User.findById(userId)
    const index = user.savedPosts.indexOf(reelId)

    if (index !== -1) {
      user.savedPosts.splice(index, 1)
      await user.save()

      logger.info('Reel dejado de guardar:', { userId, reelId })

      return res.status(200).json({
        success: true,
        message: 'Reel eliminado de guardados'
      })
    }

    return res.status(400).json({
      success: false,
      message: 'El reel no está guardado'
    })
  } catch (error) {
    logger.error('Error al dejar de guardar reel:', { error: error.message })
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar el reel de guardados'
    })
  }
}

// Registrar visualización de un reel
export const viewReel = async (req, res) => {
  try {
    const reelId = req.params.id
    const { userId } = req

    const reel = await Reel.findById(reelId)

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Solo agregar vista si el usuario no es el dueño
    if (reel.user.toString() !== userId) {
      await reel.addView(userId)
      logger.info('View registered for reel:', { reelId, userId })
    }

    res.json({
      success: true,
      viewsCount: reel.views.length
    })
  } catch (error) {
    logger.error('Error en viewReel:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Crear un Duet (video lado a lado con el original)
export const createDuet = async (req, res) => {
  try {
    const { originalReelId } = req.params
    const { caption, hashtags, location, audioTitle, audioArtist } = req.body
    const userId = req.userId

    // Verificar que se subió un video
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: 'El video es obligatorio para crear un duet'
      })
    }

    // Verificar que el reel original existe
    const originalReel = await Reel.findById(originalReelId)
      .populate('user', 'username avatar fullName')

    if (!originalReel) {
      return res.status(404).json({
        success: false,
        message: 'Reel original no encontrado'
      })
    }

    // Verificar que el reel permite duets
    if (!originalReel.allowDuets) {
      return res.status(403).json({
        success: false,
        message: 'Este reel no permite duets'
      })
    }

    // Verificar que no sea el mismo usuario
    if (originalReel.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes hacer un duet de tu propio reel'
      })
    }

    // Obtener URL del video nuevo
    const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`
    const videoUrl = `${baseUrl}/uploads/${req.files.video[0].filename}`

    // Crear nuevo reel como duet
    const duetData = {
      user: userId,
      video: {
        url: videoUrl,
        thumbnail: videoUrl.replace(/\.[^/.]+$/, '_thumb.jpg'),
        duration: 0,
        width: 1080,
        height: 1920
      },
      caption: caption || `Duet con @${originalReel.user.username}`,
      hashtags: hashtags
        ? hashtags.split(',').map(tag => tag.trim().replace('#', ''))
        : [],
      allowComments: true,
      allowDuets: true,
      allowStitches: true,
      // Referencia al reel original en el array de duets
      isDuet: true,
      originalReel: originalReelId
    }

    if (audioTitle || audioArtist) {
      duetData.audio = {
        title: audioTitle || originalReel.audio?.title || '',
        artist: audioArtist || originalReel.audio?.artist || ''
      }
    }

    if (location) {
      duetData.location = { name: location }
    }

    // Crear el duet
    const duetReel = new Reel(duetData)
    await duetReel.save()
    await duetReel.populate('user', 'username avatar fullName')

    // Agregar referencia en el reel original
    originalReel.duets.push({
      originalReel: duetReel._id,
      user: userId
    })
    await originalReel.save()

    // Notificar al dueño del reel original
    const currentUser = await User.findById(userId)
    await Notification.create({
      user: originalReel.user._id,
      type: 'duet',
      fromUser: userId,
      content: `${currentUser.username} hizo un duet con tu reel`,
      relatedContent: {
        type: 'reel',
        id: duetReel._id
      }
    })

    logger.info('Duet creado exitosamente:', {
      duetId: duetReel._id,
      originalReelId,
      userId
    })

    res.status(201).json({
      success: true,
      message: 'Duet creado exitosamente',
      reel: duetReel,
      originalReel: {
        _id: originalReel._id,
        user: originalReel.user,
        caption: originalReel.caption
      }
    })
  } catch (error) {
    logger.error('Error en createDuet:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Crear un Stitch (usar clip del original y agregar reacción)
export const createStitch = async (req, res) => {
  try {
    const { originalReelId } = req.params
    const { caption, hashtags, location, audioTitle, audioArtist, stitchStartTime, stitchDuration } = req.body
    const userId = req.userId

    // Verificar que se subió un video
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: 'El video es obligatorio para crear un stitch'
      })
    }

    // Verificar que el reel original existe
    const originalReel = await Reel.findById(originalReelId)
      .populate('user', 'username avatar fullName')

    if (!originalReel) {
      return res.status(404).json({
        success: false,
        message: 'Reel original no encontrado'
      })
    }

    // Verificar que el reel permite stitches
    if (!originalReel.allowStitches) {
      return res.status(403).json({
        success: false,
        message: 'Este reel no permite stitches'
      })
    }

    // Verificar que no sea el mismo usuario
    if (originalReel.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes hacer un stitch de tu propio reel'
      })
    }

    // Obtener URL del video nuevo
    const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`
    const videoUrl = `${baseUrl}/uploads/${req.files.video[0].filename}`

    // Crear nuevo reel como stitch
    const stitchData = {
      user: userId,
      video: {
        url: videoUrl,
        thumbnail: videoUrl.replace(/\.[^/.]+$/, '_thumb.jpg'),
        duration: 0,
        width: 1080,
        height: 1920
      },
      caption: caption || `Stitch con @${originalReel.user.username}`,
      hashtags: hashtags
        ? hashtags.split(',').map(tag => tag.trim().replace('#', ''))
        : [],
      allowComments: true,
      allowDuets: true,
      allowStitches: true,
      // Referencia al reel original
      isStitch: true,
      originalReel: originalReelId,
      stitchMetadata: {
        startTime: parseInt(stitchStartTime) || 0,
        duration: parseInt(stitchDuration) || 5
      }
    }

    if (audioTitle || audioArtist) {
      stitchData.audio = {
        title: audioTitle || originalReel.audio?.title || '',
        artist: audioArtist || originalReel.audio?.artist || ''
      }
    }

    if (location) {
      stitchData.location = { name: location }
    }

    // Crear el stitch
    const stitchReel = new Reel(stitchData)
    await stitchReel.save()
    await stitchReel.populate('user', 'username avatar fullName')

    // Agregar referencia en el reel original
    originalReel.stitches.push({
      originalReel: stitchReel._id,
      user: userId
    })
    await originalReel.save()

    // Notificar al dueño del reel original
    const currentUser = await User.findById(userId)
    await Notification.create({
      user: originalReel.user._id,
      type: 'stitch',
      fromUser: userId,
      content: `${currentUser.username} hizo un stitch con tu reel`,
      relatedContent: {
        type: 'reel',
        id: stitchReel._id
      }
    })

    logger.info('Stitch creado exitosamente:', {
      stitchId: stitchReel._id,
      originalReelId,
      userId
    })

    res.status(201).json({
      success: true,
      message: 'Stitch creado exitosamente',
      reel: stitchReel,
      originalReel: {
        _id: originalReel._id,
        user: originalReel.user,
        caption: originalReel.caption
      }
    })
  } catch (error) {
    logger.error('Error en createStitch:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener duets de un reel
export const getReelDuets = async (req, res) => {
  try {
    const { reelId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const reel = await Reel.findById(reelId)

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Obtener IDs de duets
    const duetIds = reel.duets.map(d => d.originalReel)

    // Obtener duets con paginación
    const [duets, total] = await Promise.all([
      Reel.find({ _id: { $in: duetIds } })
        .populate('user', 'username avatar fullName isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      duetIds.length
    ])

    res.json({
      success: true,
      duets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getReelDuets:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener stitches de un reel
export const getReelStitches = async (req, res) => {
  try {
    const { reelId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const reel = await Reel.findById(reelId)

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado'
      })
    }

    // Obtener IDs de stitches
    const stitchIds = reel.stitches.map(s => s.originalReel)

    // Obtener stitches con paginación
    const [stitches, total] = await Promise.all([
      Reel.find({ _id: { $in: stitchIds } })
        .populate('user', 'username avatar fullName isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      stitchIds.length
    ])

    res.json({
      success: true,
      stitches,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getReelStitches:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export default {
  createReel,
  getReelsForFeed,
  getReel,
  getUserReels,
  deleteReel,
  likeReel,
  unlikeReel,
  commentReel,
  getTrendingReels,
  searchReelsByHashtag,
  saveReel,
  unsaveReel,
  viewReel,
  createDuet,
  createStitch,
  getReelDuets,
  getReelStitches
}

