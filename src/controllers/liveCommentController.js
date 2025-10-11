import LiveComment from '../models/LiveComment.js'
import LiveStream from '../models/LiveStream.js'
import Notification from '../models/Notification.js'
import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'

// Crear un comentario en transmisión en vivo
export const createComment = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { streamId } = req.params
    const {
      content,
      type = 'comment',
      replyTo,
      timestamp,
      clientId
    } = req.body

    // Verificar que la transmisión existe y está en vivo
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

    if (!liveStream.allowComments) {
      return res.status(403).json({
        success: false,
        message: 'Los comentarios están deshabilitados en esta transmisión'
      })
    }

    // Verificar que el comentario de respuesta existe si se especifica
    if (replyTo) {
      const parentComment = await LiveComment.findById(replyTo)
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Comentario de respuesta no encontrado'
        })
      }
    }

    // Crear el comentario
    const commentData = {
      liveStream: streamId,
      user: req.user.id,
      content: content.trim(),
      type,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      clientId,
      ...(replyTo && { replyTo })
    }

    const comment = new LiveComment(commentData)
    await comment.save()

    // Poblar información del usuario
    await comment.populate('user', 'username avatar fullName isVerified')
    if (replyTo) {
      await comment.populate('replyTo.user', 'username avatar fullName')
    }

    // Incrementar contador de comentarios en el live stream
    liveStream.comments += 1
    await liveStream.save()

    // Notificar al streamer y co-hosts si está habilitado
    if (comment.notifyStreamer) {
      await notifyStreamerAboutComment(comment, liveStream)
    }

    // Emitir evento en tiempo real (WebSocket)
    // Esto se implementaría con Socket.IO
    // socketService.emitToStream(streamId, 'new_comment', comment);

    // Limpiar caché
    await cache.deletePattern(`live_comments:${streamId}:*`)

    logger.info('💬 Live comment creado:', {
      id: comment._id,
      streamId,
      user: req.user.id,
      type
    })

    res.status(201).json({
      success: true,
      message: 'Comentario creado exitosamente',
      data: comment
    })
  } catch (error) {
    logger.error('Error creando live comment:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener comentarios de una transmisión
export const getComments = async (req, res) => {
  try {
    const { streamId } = req.params
    const {
      page = 1,
      limit = 50,
      since,
      type,
      sortByPinned = true
    } = req.query

    // Implementar caché para mejorar rendimiento
    const cacheKey = `live_comments:${streamId}:${page}:${limit}:${since || 'all'}:${type || 'all'}`
    logger.info('Cache key generado para comentarios en vivo:', { cacheKey })

    // Verificar que la transmisión existe
    const liveStream = await LiveStream.findById(streamId)
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    const options = {
      type,
      limit: parseInt(limit),
      sortByPinned: sortByPinned === 'true'
    }

    let comments
    const sinceDate = since ? new Date(since) : null

    if (sinceDate) {
      // Obtener comentarios recientes
      comments = await LiveComment.getRecentComments(
        streamId,
        sinceDate,
        options.limit
      )
    } else {
      // Obtener comentarios con paginación
      const skip = (parseInt(page) - 1) * parseInt(limit)
      comments = await LiveComment.find({
        liveStream: streamId,
        isVisible: true
      })
        .populate('user', 'username avatar fullName isVerified')
        .populate('replyTo.user', 'username avatar fullName')
        .populate('reactions.user', 'username avatar')
        .sort(
          options.sortByPinned
            ? { isPinned: -1, timestamp: 1 }
            : { timestamp: 1 }
        )
        .limit(options.limit)
        .skip(skip)
    }

    const response = {
      success: true,
      data: comments,
      pagination: sinceDate
        ? null
        : {
          page: parseInt(page),
          limit: parseInt(limit),
          total: await LiveComment.countDocuments({
            liveStream: streamId,
            isVisible: true
          })
        }
    }

    // Guardar en caché por 10 segundos
    await cache.set(cacheKey, response, 10)

    res.json(response)
  } catch (error) {
    logger.error('Error obteniendo live comments:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Reaccionar a un comentario
export const reactToComment = async (req, res) => {
  try {
    const { commentId } = req.params
    const { reactionType = 'like' } = req.body

    const comment = await LiveComment.findById(commentId)
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    // Verificar que la transmisión está en vivo
    const liveStream = await LiveStream.findById(comment.liveStream)
    if (!liveStream || liveStream.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'La transmisión no está en vivo'
      })
    }

    await comment.addReaction(req.user.id, reactionType)

    // Limpiar caché
    // Cache eliminado - await cache.deletePattern(`live_comments:${comment.liveStream}:*`);

    res.json({
      success: true,
      message: 'Reacción agregada exitosamente',
      data: {
        reactionCount: comment.reactionCount,
        userReaction: reactionType
      }
    })
  } catch (error) {
    logger.error('Error reaccionando a comment:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Remover reacción de un comentario
export const removeReaction = async (req, res) => {
  try {
    const { commentId } = req.params

    const comment = await LiveComment.findById(commentId)
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    await comment.removeReaction(req.user.id)

    // Limpiar caché
    // Cache eliminado - await cache.deletePattern(`live_comments:${comment.liveStream}:*`);

    res.json({
      success: true,
      message: 'Reacción removida exitosamente',
      data: {
        reactionCount: comment.reactionCount,
        userReaction: null
      }
    })
  } catch (error) {
    logger.error('Error removiendo reacción:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Moderar comentario (solo streamer y co-hosts)
export const moderateComment = async (req, res) => {
  try {
    const { commentId } = req.params
    const { action, reason } = req.body // action: 'hide', 'delete', 'pin', 'unpin'

    const comment = await LiveComment.findById(commentId)
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    // Verificar permisos de moderación
    const liveStream = await LiveStream.findById(comment.liveStream)
    if (!liveStream) {
      return res.status(404).json({
        success: false,
        message: 'Transmisión no encontrada'
      })
    }

    const isStreamer = liveStream.user.toString() === req.user.id
    const isCoHost = liveStream.coHosts.some(
      coHost =>
        coHost.user.toString() === req.user.id &&
        ['accepted', 'joined'].includes(coHost.status)
    )

    if (!isStreamer && !isCoHost) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para moderar comentarios'
      })
    }

    let result

    switch (action) {
    case 'hide':
      result = await comment.moderate(req.user.id, reason, 'hide')
      break
    case 'delete':
      result = await comment.moderate(req.user.id, reason, 'delete')
      break
    case 'pin':
      result = await comment.pin()
      break
    case 'unpin':
      result = await comment.unpin()
      break
    default:
      return res.status(400).json({
        success: false,
        message: 'Acción de moderación no válida'
      })
    }

    // Limpiar caché
    // Cache eliminado - await cache.deletePattern(`live_comments:${comment.liveStream}:*`);

    logger.info('🛡️ Live comment moderado:', {
      commentId,
      action,
      moderator: req.user.id,
      streamId: comment.liveStream
    })

    res.json({
      success: true,
      message: `Comentario ${action} exitosamente`,
      data: result
    })
  } catch (error) {
    logger.error('Error moderando comment:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener estadísticas de comentarios
export const getCommentStats = async (req, res) => {
  try {
    const { streamId } = req.params

    // Implementar caché para estadísticas
    const cacheKey = `live_comment_stats:${streamId}`
    logger.info('Cache key generado para estadísticas:', { cacheKey })

    const stats = await LiveComment.getCommentStats(streamId)
    const result = stats[0] || {
      totalComments: 0,
      visibleComments: 0,
      moderatedComments: 0,
      pinnedComments: 0,
      totalReactions: 0,
      avgReactionsPerComment: 0
    }

    // Guardar en caché por 30 segundos
    await cache.set(cacheKey, result, 30)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Error obteniendo comment stats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Función auxiliar para notificar al streamer sobre comentarios
async function notifyStreamerAboutComment(comment, liveStream) {
  try {
    // Notificar al streamer principal
    if (comment.user._id.toString() !== liveStream.user.toString()) {
      await Notification.create({
        user: liveStream.user,
        from: comment.user._id,
        type: 'live_comment',
        title: 'Nuevo comentario en tu transmisión',
        message: `${comment.user.username}: ${comment.content.substring(0, 50)}...`,
        data: {
          liveStreamId: liveStream._id,
          commentId: comment._id,
          commentType: comment.type
        }
      })
    }

    // Notificar a co-hosts si está habilitado
    if (comment.notifyCoHosts && liveStream.coHosts.length > 0) {
      const coHostNotifications = liveStream.coHosts
        .filter(coHost => ['accepted', 'joined'].includes(coHost.status))
        .map(coHost => ({
          user: coHost.user,
          from: comment.user._id,
          type: 'live_comment',
          title: 'Nuevo comentario en transmisión',
          message: `${comment.user.username}: ${comment.content.substring(0, 50)}...`,
          data: {
            liveStreamId: liveStream._id,
            commentId: comment._id,
            commentType: comment.type
          }
        }))

      if (coHostNotifications.length > 0) {
        await Notification.insertMany(coHostNotifications)
      }
    }
  } catch (error) {
    logger.error('Error notificando streamer sobre comentario:', error)
  }
}
