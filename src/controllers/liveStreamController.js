import LiveStream from '../models/LiveStream.js'
import LiveComment from '../models/LiveComment.js'
import CSTV from '../models/CSTV.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'

// Crear una nueva transmisión en vivo
export const createLiveStream = async (req, res) => {
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
      isPublic = true,
      allowComments = true,
      allowShares = true,
      notifyFollowers = true,
      notifyCloseFriends = false,
      scheduledAt,
      saveToCSTV = false
    } = req.body

    // Crear la transmisión
    const liveStreamData = {
      user: req.user.id,
      title: title || 'Transmisión en vivo',
      description: description || '',
      isPublic,
      allowComments,
      allowShares,
      notifyFollowers,
      notifyCloseFriends,
      saveToCSTV
    }

    // Si se programa para el futuro
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt)
      if (scheduledDate > new Date()) {
        liveStreamData.status = 'scheduled'
        liveStreamData.scheduledAt = scheduledDate
      }
    }

    const liveStream = new LiveStream(liveStreamData)
    await liveStream.save()

    // Poblar información del usuario
    await liveStream.populate('user', 'username avatar fullName isVerified')

    // Notificar a seguidores si está habilitado
    if (notifyFollowers && liveStream.status === 'live') {
      await notifyFollowersAboutLive(liveStream)
    }

    logger.info('📺 Live stream creado:', {
      id: liveStream._id,
      user: req.user.id,
      status: liveStream.status
    })

    res.status(201).json({
      success: true,
      message: 'Transmisión en vivo creada exitosamente',
      data: liveStream
    })
  } catch (error) {
    logger.error('Error creando live stream:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener transmisiones en vivo
export const getLiveStreams = async (req, res) => {
  try {
    const {
      status = 'live',
      category,
      userId,
      page = 1,
      limit = 20
    } = req.query

    // Implementar caché para mejorar rendimiento
    const cacheKey = `live_streams:${status}:${category || 'all'}:${userId || 'all'}:${page}:${limit}`
    logger.info('Cache key generado para streams en vivo:', { cacheKey })

    // Intentar obtener del caché
    const cachedStreams = await cache.get(cacheKey)
    if (cachedStreams) {
      logger.info('Streams en vivo servidos desde caché')
      return res.json(cachedStreams)
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    }

    let streams

    if (status === 'live') {
      streams = await LiveStream.getLiveStreams({
        userId,
        isPublic: category === 'public' ? true : undefined
      })
    } else if (status === 'scheduled') {
      streams = await LiveStream.getScheduledStreams({
        userId
      })
    } else {
      const query = { status }
      if (userId) { query.user = userId }

      streams = await LiveStream.find(query)
        .populate('user', 'username avatar fullName isVerified')
        .populate('coHosts.user', 'username avatar fullName')
        .sort({ createdAt: -1 })
        .limit(options.limit)
        .skip(options.skip)
    }

    const total = await LiveStream.countDocuments({
      status,
      ...(userId && { user: userId })
    })

    const response = {
      success: true,
      data: streams,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    }

    // Guardar en caché por 30 segundos
    await cache.set(cacheKey, response, 30)

    res.json(response)
  } catch (error) {
    logger.error('Error obteniendo live streams:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener una transmisión específica
export const getLiveStream = async (req, res) => {
  try {
    const { streamId } = req.params

    // Implementar caché para stream individual
    const cacheKey = `live_stream:${streamId}`
    logger.info('Cache key generado para stream individual:', { cacheKey })

    const liveStream = await LiveStream.findById(streamId)
      .populate('user', 'username avatar fullName isVerified followers')
      .populate('coHosts.user', 'username avatar fullName')

    // Obtener estadísticas de comentarios si los comentarios están habilitados
    let commentStats = null
    if (liveStream && liveStream.allowComments) {
      commentStats = await LiveComment.getCommentStats(streamId)
    }

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    // Verificar permisos de acceso
    if (
      !liveStream.isPublic &&
      liveStream.user._id.toString() !== req.user?.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a esta transmisión'
      })
    }

    // Guardar en caché por 10 segundos
    // Cache eliminado - await cache.set(cacheKey, liveStream, 10);

    res.json({
      success: true,
      data: {
        ...liveStream.toObject(),
        commentStats: commentStats ? commentStats[0] || {
          totalComments: 0,
          visibleComments: 0,
          moderatedComments: 0
        } : null
      }
    })
  } catch (error) {
    logger.error('Error obteniendo live stream:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Iniciar transmisión en vivo
export const startLiveStream = async (req, res) => {
  try {
    const { streamId } = req.params
    const { streamKey, rtmpUrl, playbackUrl, thumbnailUrl } = req.body

    const liveStream = await LiveStream.findById(streamId)

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    // Verificar que el usuario es el propietario
    if (liveStream.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para iniciar esta transmisión'
      })
    }

    // Verificar que no esté ya en vivo
    if (liveStream.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'La transmisión ya está en vivo'
      })
    }

    // Iniciar la transmisión
    await liveStream.startStream(streamKey, rtmpUrl, playbackUrl)

    if (thumbnailUrl) {
      liveStream.thumbnailUrl = thumbnailUrl
      await liveStream.save()
    }

    // Notificar a seguidores
    if (liveStream.notifyFollowers) {
      await notifyFollowersAboutLive(liveStream)
    }

    // Limpiar caché
    await cache.deletePattern(`live_stream:${streamId}`)
    await cache.deletePattern('live_streams:*')

    logger.info('📺 Live stream iniciado:', {
      id: streamId,
      user: req.user.id
    })

    res.json({
      success: true,
      message: 'Transmisión iniciada exitosamente',
      data: liveStream
    })
  } catch (error) {
    logger.error('Error iniciando live stream:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Terminar transmisión en vivo
export const endLiveStream = async (req, res) => {
  try {
    const { streamId } = req.params
    const { saveToCSTV, cstvTitle, cstvDescription, cstvCategory } = req.body

    const liveStream = await LiveStream.findById(streamId)

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    // Verificar que el usuario es el propietario
    if (liveStream.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para terminar esta transmisión'
      })
    }

    // Verificar que esté en vivo
    if (liveStream.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'La transmisión no está en vivo'
      })
    }

    // Terminar la transmisión
    await liveStream.endStream()

    let cstvVideo = null

    // Guardar como CSTV si se solicita
    if (saveToCSTV && liveStream.playbackUrl) {
      cstvVideo = await saveLiveToCSTV(liveStream, {
        title: cstvTitle || liveStream.title,
        description: cstvDescription || liveStream.description,
        category: cstvCategory || 'entertainment'
      })
    }

    // Limpiar caché
    await cache.deletePattern(`live_stream:${streamId}`)
    await cache.deletePattern('live_streams:*')

    logger.info('📺 Live stream terminado:', {
      id: streamId,
      user: req.user.id,
      duration: liveStream.duration,
      viewers: liveStream.viewers.peak,
      savedToCSTV: !!cstvVideo
    })

    res.json({
      success: true,
      message: 'Transmisión terminada exitosamente',
      data: {
        liveStream,
        cstvVideo
      }
    })
  } catch (error) {
    logger.error('Error terminando live stream:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Agregar viewer a la transmisión
export const addViewer = async (req, res) => {
  try {
    const { streamId } = req.params

    const liveStream = await LiveStream.findById(streamId)

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    if (liveStream.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'La transmisión no está en vivo'
      })
    }

    await liveStream.addViewer()

    // Limpiar caché
    // Cache eliminado - await cache.delete(`live_stream:${streamId}`);

    res.json({
      success: true,
      data: {
        currentViewers: liveStream.viewers.current,
        totalViewers: liveStream.viewers.total,
        peakViewers: liveStream.viewers.peak
      }
    })
  } catch (error) {
    logger.error('Error agregando viewer:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Remover viewer de la transmisión
export const removeViewer = async (req, res) => {
  try {
    const { streamId } = req.params

    const liveStream = await LiveStream.findById(streamId)

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    await liveStream.removeViewer()

    // Limpiar caché
    // Cache eliminado - await cache.delete(`live_stream:${streamId}`);

    res.json({
      success: true,
      data: {
        currentViewers: liveStream.viewers.current,
        totalViewers: liveStream.viewers.total,
        peakViewers: liveStream.viewers.peak
      }
    })
  } catch (error) {
    logger.error('Error removiendo viewer:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Invitar co-host
export const inviteCoHost = async (req, res) => {
  try {
    const { streamId } = req.params
    const { userId } = req.body

    const liveStream = await LiveStream.findById(streamId)

    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    // Verificar que el usuario es el propietario
    if (liveStream.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para invitar co-hosts'
      })
    }

    // Verificar que el usuario invitado existe
    const invitedUser = await User.findById(userId)
    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Agregar co-host
    const existingCoHost = liveStream.coHosts.find(
      coHost => coHost.user.toString() === userId
    )

    if (existingCoHost) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está invitado como co-host'
      })
    }

    liveStream.coHosts.push({
      user: userId,
      status: 'invited'
    })

    await liveStream.save()

    // Crear notificación para el usuario invitado
    await Notification.create({
      user: userId,
      from: req.user.id,
      type: 'live_invitation',
      title: 'Invitación a transmisión en vivo',
      message: `${req.user.username} te invitó a ser co-host en su transmisión en vivo`,
      data: {
        liveStreamId: streamId,
        liveStreamTitle: liveStream.title
      }
    })

    // Limpiar caché
    // Cache eliminado - await cache.delete(`live_stream:${streamId}`);

    logger.info('📺 Co-host invitado:', {
      streamId,
      host: req.user.id,
      invitedUser: userId
    })

    res.json({
      success: true,
      message: 'Invitación enviada exitosamente',
      data: liveStream
    })
  } catch (error) {
    logger.error('Error invitando co-host:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Función auxiliar para notificar seguidores sobre transmisión en vivo
async function notifyFollowersAboutLive(liveStream) {
  try {
    const user = await User.findById(liveStream.user).populate('followers')

    if (!user || !user.followers || user.followers.length === 0) {
      return
    }

    const notifications = user.followers.map(followerId => ({
      user: followerId,
      from: liveStream.user,
      type: 'live_started',
      title: 'Transmisión en vivo',
      message: `${user.username} está transmitiendo en vivo`,
      data: {
        liveStreamId: liveStream._id,
        liveStreamTitle: liveStream.title
      }
    }))

    await Notification.insertMany(notifications)

    logger.info(
      `📺 Notificaciones enviadas a ${user.followers.length} seguidores sobre live stream`
    )
  } catch (error) {
    logger.error('Error notificando seguidores sobre live stream:', error)
  }
}

// Función auxiliar para guardar live como CSTV
async function saveLiveToCSTV(liveStream, options) {
  try {
    const cstvData = {
      user: liveStream.user,
      title: options.title,
      description: options.description,
      originalLiveStream: liveStream._id,
      isFromLiveStream: true,
      video: {
        url: liveStream.playbackUrl,
        thumbnail: liveStream.thumbnailUrl || '',
        duration: liveStream.duration,
        size: 0, // Se calcularía en el proceso de transcoding
        resolution: {
          width: 1920,
          height: 1080
        },
        format: 'mp4'
      },
      category: options.category,
      visibility: 'public',
      isPublished: true,
      publishedAt: new Date()
    }

    const cstvVideo = new CSTV(cstvData)
    await cstvVideo.save()

    // Actualizar el live stream con la referencia al CSTV
    liveStream.saveToIGTV = true
    liveStream.igtvVideoUrl = cstvVideo.video.url
    await liveStream.save()

    logger.info('📺 Live stream guardado como CSTV:', {
      liveStreamId: liveStream._id,
      cstvId: cstvVideo._id
    })

    return cstvVideo
  } catch (error) {
    logger.error('Error guardando live stream como CSTV:', error)
    throw error
  }
}

// Obtener transmisiones en vivo de un usuario específico
export const getUserLiveStreams = async (req, res) => {
  try {
    const { username } = req.params
    const { page = 1, limit = 20, status } = req.query

    // Buscar el usuario por username
    const user = await User.findOne({ username }).select('_id')
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Construir filtro de búsqueda
    const filter = {
      user: user._id
    }

    // Agregar filtro de estado si se especifica
    if (status) {
      filter.status = status
    }

    // Obtener transmisiones del usuario
    const liveStreams = await LiveStream.find(filter)
      .populate('user', 'username profilePicture verified')
      .populate('coHosts.user', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))

    const total = await LiveStream.countDocuments(filter)

    res.json({
      success: true,
      data: {
        liveStreams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    })
  } catch (error) {
    logger.error('Error obteniendo transmisiones en vivo del usuario:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Dar like a un live stream
export const likeLiveStream = async (req, res) => {
  try {
    const streamId = req.params.id
    const { userId } = req

    const stream = await LiveStream.findById(streamId)

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    await stream.addLike(userId)

    // Notificar al streamer si no es él mismo
    if (stream.user.toString() !== userId) {
      await Notification.create({
        user: stream.user,
        type: 'like',
        from: userId,
        title: 'Nuevo me gusta',
        message: 'Le gustó tu transmisión en vivo'
      })
    }

    logger.info('Like agregado a live stream:', { streamId, userId })

    res.json({
      success: true,
      liked: true,
      likesCount: stream.likes.length
    })
  } catch (error) {
    logger.error('Error en likeLiveStream:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Quitar like de un live stream
export const unlikeLiveStream = async (req, res) => {
  try {
    const streamId = req.params.id
    const { userId } = req

    const stream = await LiveStream.findById(streamId)

    if (!stream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    await stream.removeLike(userId)

    logger.info('Like removido de live stream:', { streamId, userId })

    res.json({
      success: true,
      liked: false,
      likesCount: stream.likes.length
    })
  } catch (error) {
    logger.error('Error en unlikeLiveStream:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

export default {
  createLiveStream,
  getLiveStreams,
  getLiveStream,
  startLiveStream,
  endLiveStream,
  addViewer,
  removeViewer,
  inviteCoHost,
  getUserLiveStreams,
  likeLiveStream,
  unlikeLiveStream
}

