import CSTV from '../models/CSTV.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'

// Crear un nuevo video CSTV
export const createCSTVVideo = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const {
      title,
      description,
      video,
      category = 'other',
      visibility = 'public',
      ageRestriction = 'all',
      allowComments = true,
      allowLikes = true,
      allowShares = true,
      tags = [],
      monetization = { enabled: false },
      scheduling = { isScheduled: false }
    } = req.body

    const cstvData = {
      user: req.user.id,
      title,
      description,
      video,
      category,
      visibility,
      ageRestriction,
      allowComments,
      allowLikes,
      allowShares,
      tags,
      monetization,
      scheduling,
      isPublished: !scheduling.isScheduled
    }

    const cstvVideo = new CSTV(cstvData)
    await cstvVideo.save()

    // Poblar información del usuario
    await cstvVideo.populate('user', 'username avatar fullName isVerified')

    logger.info('📺 CSTV video creado:', {
      id: cstvVideo._id,
      user: req.user.id,
      title: cstvVideo.title
    })

    res.status(201).json({
      success: true,
      message: 'Video CSTV creado exitosamente',
      data: cstvVideo
    })
  } catch (error) {
    logger.error('Error creando CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener videos CSTV
export const getCSTVVideos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      userId,
      sortBy = 'newest'
    } = req.query

    // Implementar caché para mejorar rendimiento
    const cacheKey = `cstv_videos:${page}:${limit}:${category || 'all'}:${userId || 'all'}`
    logger.info('Cache key generado para videos CSTV:', { cacheKey })

    // Intentar obtener del caché
    const cachedVideos = await cache.get(cacheKey)
    if (cachedVideos) {
      logger.info('Videos CSTV servidos desde caché')
      return res.json(cachedVideos)
    }

    const options = {
      category,
      userId,
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    }

    let videos

    switch (sortBy) {
      case 'trending':
        videos = await CSTV.getTrendingVideos(options)
        break
      case 'views':
        videos = await CSTV.find({
          isPublished: true,
          visibility: 'public',
          'moderation.status': 'approved',
          ...(category && { category }),
          ...(userId && { user: userId })
        })
          .populate('user', 'username avatar fullName isVerified')
          .sort({ 'views.total': -1 })
          .limit(options.limit)
          .skip(options.skip)
        break
      case 'likes':
        videos = await CSTV.find({
          isPublished: true,
          visibility: 'public',
          'moderation.status': 'approved',
          ...(category && { category }),
          ...(userId && { user: userId })
        })
          .populate('user', 'username avatar fullName isVerified')
          .sort({ likesCount: -1 })
          .limit(options.limit)
          .skip(options.skip)
        break
      default: // newest
        videos = await CSTV.getPublicVideos(options)
        break
    }

    const total = await CSTV.countDocuments({
      isPublished: true,
      visibility: 'public',
      'moderation.status': 'approved',
      ...(category && { category }),
      ...(userId && { user: userId })
    })

    const response = {
      success: true,
      data: videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }

    // Guardar en caché por 5 minutos
    await cache.set(cacheKey, response, 300)

    res.json(response)
  } catch (error) {
    logger.error('Error obteniendo CSTV videos:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener un video específico
export const getCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    // Cache eliminado para simplificar el desarrollo local

    const video = await CSTV.findById(videoId).populate(
      'user',
      'username avatar fullName isVerified followers'
    )

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    // Verificar permisos de acceso
    if (
      video.visibility === 'private' &&
      video.user._id.toString() !== req.user?.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este video'
      })
    }

    // Incrementar views
    await video.addView(req.user?.id)

    // Guardar en caché por 10 minutos
    // Cache eliminado - await cache.set(cacheKey, video, 600);

    res.json({
      success: true,
      data: video
    })
  } catch (error) {
    logger.error('Error obteniendo CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar un video CSTV
export const updateCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params
    const updates = req.body

    const video = await CSTV.findById(videoId)

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    // Verificar que el usuario es el propietario
    if (video.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este video'
      })
    }

    // Actualizar campos permitidos
    const allowedUpdates = [
      'title',
      'description',
      'category',
      'visibility',
      'ageRestriction',
      'allowComments',
      'allowLikes',
      'allowShares',
      'tags',
      'seo'
    ]

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        video[field] = updates[field]
      }
    })

    await video.save()

    // Limpiar caché
    await cache.deletePattern(`cstv_video:${videoId}`)
    await cache.deletePattern('cstv_videos:*')

    logger.info('📺 CSTV video actualizado:', {
      id: videoId,
      user: req.user.id
    })

    res.json({
      success: true,
      message: 'Video actualizado exitosamente',
      data: video
    })
  } catch (error) {
    logger.error('Error actualizando CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar un video CSTV
export const deleteCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    const video = await CSTV.findById(videoId)

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    // Verificar que el usuario es el propietario
    if (video.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este video'
      })
    }

    await CSTV.findByIdAndDelete(videoId)

    // Limpiar caché
    await cache.deletePattern(`cstv_video:${videoId}`)
    await cache.deletePattern('cstv_videos:*')

    logger.info('📺 CSTV video eliminado:', {
      id: videoId,
      user: req.user.id
    })

    res.json({
      success: true,
      message: 'Video eliminado exitosamente'
    })
  } catch (error) {
    logger.error('Error eliminando CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Dar like a un video CSTV
export const likeCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    const video = await CSTV.findById(videoId)

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    if (!video.allowLikes) {
      return res.status(403).json({
        success: false,
        message: 'Los likes están deshabilitados en este video'
      })
    }

    const isLiked = await video.toggleLike(req.user.id)

    // Crear notificación si el like es nuevo y no es el propio usuario
    if (isLiked && video.user.toString() !== req.user.id) {
      await Notification.create({
        user: video.user,
        from: req.user.id,
        type: 'like',
        content: {
          cstv: videoId
        }
      })
    }

    // Limpiar caché
    await cache.deletePattern(`cstv_video:${videoId}`)
    await cache.deletePattern('cstv_videos:*')

    res.json({
      success: true,
      message: 'Like actualizado exitosamente',
      data: {
        likesCount: video.likesCount,
        isLiked: video.likes.includes(req.user.id)
      }
    })
  } catch (error) {
    logger.error('Error dando like a CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Quitar like de un video CSTV
export const unlikeCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    const video = await CSTV.findById(videoId)

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    await video.toggleLike(req.user.id)

    // Limpiar caché
    await cache.deletePattern(`cstv_video:${videoId}`)
    await cache.deletePattern('cstv_videos:*')

    res.json({
      success: true,
      message: 'Like removido exitosamente',
      data: {
        likesCount: video.likesCount,
        isLiked: video.likes.includes(req.user.id)
      }
    })
  } catch (error) {
    logger.error('Error removiendo like de CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Guardar un video CSTV
export const saveCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    const video = await CSTV.findById(videoId)

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    await video.toggleSave(req.user.id)

    // Limpiar caché
    // Cache eliminado - await cache.deletePattern(`cstv_video:${videoId}`);

    res.json({
      success: true,
      message: 'Video guardado exitosamente',
      data: {
        savesCount: video.savesCount,
        isSaved: video.saves.includes(req.user.id)
      }
    })
  } catch (error) {
    logger.error('Error guardando CSTV video:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Quitar de guardados un video CSTV
export const unsaveCSTVVideo = async (req, res) => {
  try {
    const { videoId } = req.params

    const video = await CSTV.findById(videoId)

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video no encontrado'
      })
    }

    await video.toggleSave(req.user.id)

    // Limpiar caché
    // Cache eliminado - await cache.deletePattern(`cstv_video:${videoId}`);

    res.json({
      success: true,
      message: 'Video removido de guardados exitosamente',
      data: {
        savesCount: video.savesCount,
        isSaved: video.saves.includes(req.user.id)
      }
    })
  } catch (error) {
    logger.error('Error removiendo CSTV video de guardados:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener videos trending
export const getTrendingVideos = async (req, res) => {
  try {
    const { limit = 20 } = req.query

    // Cache eliminado para simplificar el desarrollo local

    const videos = await CSTV.getTrendingVideos({
      limit: parseInt(limit)
    })

    // Guardar en caché por 10 minutos
    // Cache eliminado - await cache.set(cacheKey, videos, 600);

    res.json({
      success: true,
      data: videos
    })
  } catch (error) {
    logger.error('Error obteniendo videos trending:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Buscar videos
export const searchVideos = async (req, res) => {
  try {
    const { q: searchTerm, page = 1, limit = 20 } = req.query

    // Cache eliminado para simplificar el desarrollo local

    const videos = await CSTV.searchVideos(searchTerm, {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    })

    const total = await CSTV.countDocuments({
      isPublished: true,
      visibility: 'public',
      'moderation.status': 'approved',
      $text: { $search: searchTerm }
    })

    const response = {
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }

    // Guardar en caché por 5 minutos
    // Cache eliminado - await cache.set(cacheKey, response, 300)

    res.json({
      success: true,
      data: response
    })
  } catch (error) {
    logger.error('Error buscando videos CSTV:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener videos CSTV de un usuario específico
export const getUserCSTVVideos = async (req, res) => {
  try {
    const { username } = req.params
    const { page = 1, limit = 20 } = req.query

    // Buscar el usuario por username
    const user = await User.findOne({ username }).select('_id')
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Obtener videos del usuario
    const videos = await CSTV.find({
      user: user._id,
      isPublished: true,
      'moderation.status': 'approved'
    })
      .populate('user', 'username profilePicture verified')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await CSTV.countDocuments({
      user: user._id,
      isPublished: true,
      'moderation.status': 'approved'
    })

    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    })
  } catch (error) {
    logger.error('Error obteniendo videos CSTV del usuario:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export default {
  createCSTVVideo,
  getCSTVVideos,
  getCSTVVideo,
  updateCSTVVideo,
  deleteCSTVVideo,
  likeCSTVVideo,
  unlikeCSTVVideo,
  saveCSTVVideo,
  unsaveCSTVVideo,
  getTrendingVideos,
  searchVideos,
  getUserCSTVVideos
}

