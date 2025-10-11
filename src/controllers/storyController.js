import Story from '../models/Story.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { validationResult } from 'express-validator'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import { config } from '../utils/config.js'
import notificationService from '../services/notificationService.js'

// Implementar caché para historias
const getStoriesCacheKey = (userId, includeExpired = false) => {
  return `stories:${userId}:${includeExpired ? 'all' : 'active'}`
}

const getFeedCacheKey = () => {
  return 'stories:feed:active'
}

// Crear una nueva historia
export const createStory = async (req, res) => {
  try {
    logger.info('📝 createStory llamado con:', {
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

    const { type, caption, location, textContent, textStyle } = req.body

    const storyData = {
      user: req.userId,
      type: type || 'image',
      caption: caption || ''
    }

    logger.info('📝 Story data a crear:', storyData)

    // Agregar ubicación si se proporciona
    if (location) {
      storyData.location = { name: location }
    }

    // Obtener la URL base del servidor desde config (o fallback a request)
    const baseUrl = config.appUrl || `${req.protocol}://${req.get('host')}`

    // Manejar diferentes tipos de contenido
    switch (type) {
    case 'image':
      if (!req.files || !req.files.image) {
        return res.status(400).json({
          success: false,
          message: 'La imagen es obligatoria para historias de imagen'
        })
      }

      logger.info('Creating image story with:', {
        filename: req.files.image[0].filename,
        baseUrl,
        fullUrl: `${baseUrl}/uploads/${req.files.image[0].filename}`
      })

      storyData.content = {
        image: {
          url: `${baseUrl}/uploads/${req.files.image[0].filename}`,
          alt: caption || '',
          width: 0,
          height: 0
        }
      }
      break

    case 'video':
      if (!req.files || !req.files.video) {
        return res.status(400).json({
          success: false,
          message: 'El video es obligatorio para historias de video'
        })
      }

      logger.info('Creating video story with:', {
        filename: req.files.video[0].filename,
        baseUrl,
        fullUrl: `${baseUrl}/uploads/${req.files.video[0].filename}`
      })

      storyData.content = {
        video: {
          url: `${baseUrl}/uploads/${req.files.video[0].filename}`,
          duration: 0,
          thumbnail: `${baseUrl}/uploads/${req.files.video[0].filename.replace(/\.[^/.]+$/, '_thumb.jpg')}`,
          width: 0,
          height: 0
        }
      }
      break

    case 'text': {
      if (!textContent) {
        return res.status(400).json({
          success: false,
          message: 'El contenido de texto es obligatorio para historias de texto'
        })
      }

      // Parse textStyle si viene como JSON string
      let parsedTextStyle = {}
      if (textStyle) {
        try {
          parsedTextStyle = typeof textStyle === 'string' ? JSON.parse(textStyle) : textStyle
        } catch (error) {
          logger.error('Error parsing textStyle:', error)
          parsedTextStyle = {}
        }
      }

      storyData.content = {
        text: {
          content: textContent,
          backgroundColor: parsedTextStyle.backgroundColor || '#000000',
          textColor: parsedTextStyle.textColor || '#ffffff',
          fontSize: parsedTextStyle.fontSize || 24,
          fontFamily: parsedTextStyle.fontFamily || 'Arial'
        }
      }
      break
    }

    default:
      return res.status(400).json({
        success: false,
        message: 'Tipo de historia no válido'
      })
    }

    const story = new Story(storyData)
    await story.save()

    // Actualizar el array de stories del usuario (si existe)
    try {
      await User.findByIdAndUpdate(
        req.userId,
        { $push: { stories: story._id } }
      )
    } catch (error) {
      logger.info('No se pudo actualizar el array de stories del usuario:', error.message)
    }

    // Populate user data for response
    await story.populate('user', 'username avatar fullName')

    // Invalidar caché relacionado
    await cache.del(getFeedCacheKey())

    res.status(201).json({
      success: true,
      message: 'Historia creada exitosamente',
      story
    })
  } catch (error) {
    logger.error('Error en createStory:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener historias para el feed
export const getStoriesForFeed = async (req, res) => {
  try {
    // Implementar caché para mejorar rendimiento
    const cacheKey = getFeedCacheKey()
    logger.info('Cache key generado para feed de historias:', { cacheKey })

    // Intentar obtener del caché
    let stories = await cache.get(cacheKey)
    if (stories) {
      logger.info('Cache hit para feed de historias:', { cacheKey })
      return res.json({
        success: true,
        stories
      })
    }

    logger.info('Cache miss para feed de historias:', { cacheKey })

    // Obtener todas las stories públicas que no han expirado
    stories = await Story.find({
      isDeleted: false,
      isPublic: true,
      expiresAt: { $gt: new Date() }
    })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .limit(20)

    // Guardar en caché por 5 minutos (300 segundos)
    await cache.set(cacheKey, stories, 300)

    res.json({
      success: true,
      stories
    })
  } catch (error) {
    logger.error('Error en getStoriesForFeed:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener historias de un usuario específico
export const getUserStories = async (req, res) => {
  try {
    const { username } = req.params
    const user = await User.findOne({ username })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Implementar caché para historias de usuario
    const cacheKey = getStoriesCacheKey(user._id, false)
    logger.info('Cache key generado para historias de usuario:', { cacheKey, userId: user._id })

    // Intentar obtener del caché
    let stories = await cache.get(cacheKey)
    if (stories) {
      logger.info('Cache hit para historias de usuario:', { cacheKey })
      return res.json({
        success: true,
        stories
      })
    }

    logger.info('Cache miss para historias de usuario:', { cacheKey })

    stories = await Story.findByUser(user._id, { includeExpired: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })

    // Guardar en caché por 10 minutos (600 segundos)
    await cache.set(cacheKey, stories, 600)

    res.json({
      success: true,
      stories
    })
  } catch (error) {
    logger.error('Error en getUserStories:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener una historia específica
export const getStory = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      isDeleted: false,
      isPublic: true
    })
      .populate('user', 'username avatar fullName')
      .populate('views.user', 'username avatar')
      .populate('reactions.user', 'username avatar')
      .populate('replies.user', 'username avatar')

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      })
    }

    // Verificar si la historia ha expirado
    if (story.isExpired) {
      return res.status(404).json({
        success: false,
        message: 'Esta historia ha expirado'
      })
    }

    // Agregar vista si el usuario no es el dueño
    if (story.user._id.toString() !== req.userId) {
      await story.addView(req.userId)

      // Crear notificación para el dueño de la historia si es la primera vista
      const viewCount = story.views.length
      if (viewCount === 1) {
        // Solo notificar en la primera vista para evitar spam
        await notificationService.createNotification({
          user: story.user._id,
          from: req.userId,
          type: 'story_view',
          content: 'Alguien vio tu historia',
          relatedEntity: {
            type: 'story',
            id: story._id
          }
        })
      }
    }

    res.json({
      success: true,
      story
    })
  } catch (error) {
    logger.error('Error en getStory:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Agregar reacción a una historia
export const addReaction = async (req, res) => {
  try {
    const { reactionType } = req.body
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      })
    }

    if (story.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'No puedes reaccionar a una historia expirada'
      })
    }

    await story.addReaction(req.userId, reactionType)

    // Notificar al dueño de la historia si no es el mismo usuario
    if (story.user.toString() !== req.userId) {
      await notificationService.createNotification({
        user: story.user,
        from: req.userId,
        type: 'story_reaction',
        content: `Reaccionó a tu historia con ${reactionType}`,
        relatedEntity: {
          type: 'story',
          id: story._id
        }
      })
    }

    res.json({
      success: true,
      message: 'Reacción agregada exitosamente',
      reactionsCount: story.reactions.length
    })
  } catch (error) {
    logger.error('Error en addReaction:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Remover reacción de una historia
export const removeReaction = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      })
    }

    await story.removeReaction(req.userId)

    res.json({
      success: true,
      message: 'Reacción removida exitosamente',
      reactionsCount: story.reactions.length
    })
  } catch (error) {
    logger.error('Error en removeReaction:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Agregar respuesta a una historia
export const addReply = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      })
    }

    const { content } = req.body
    const story = await Story.findById(req.params.id)

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      })
    }

    if (story.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'No puedes responder a una historia expirada'
      })
    }

    await story.addReply(req.userId, content)

    // Notificar al dueño de la historia si no es el mismo usuario
    if (story.user.toString() !== req.userId) {
      await notificationService.createNotification({
        user: story.user,
        from: req.userId,
        type: 'story_reply',
        content: 'Respondió a tu historia',
        relatedEntity: {
          type: 'story',
          id: story._id
        }
      })
    }

    res.json({
      success: true,
      message: 'Respuesta agregada exitosamente',
      repliesCount: story.replies.length
    })
  } catch (error) {
    logger.error('Error en addReply:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar una historia
export const deleteStory = async (req, res) => {
  try {
    logger.info('🗑️ deleteStory llamado con:', {
      storyId: req.params.id,
      userId: req.userId,
      headers: req.headers
    })

    const story = await Story.findById(req.params.id)

    if (!story) {
      logger.info('❌ Story no encontrada:', req.params.id)
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      })
    }

    logger.info('📖 Story encontrada:', {
      storyId: story._id,
      storyUserId: story.user,
      requestUserId: req.userId,
      storyUserType: typeof story.user,
      requestUserIdType: typeof req.userId
    })

    // Verificar que el usuario sea el dueño de la historia
    // Convertir ambos IDs a string para comparación correcta
    const storyUserId = story.user.toString()
    const requestUserId = req.userId.toString()

    if (storyUserId !== requestUserId) {
      logger.info('❌ Permisos insuficientes:', {
        storyUser: storyUserId,
        requestUser: requestUserId,
        match: storyUserId === requestUserId
      })
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta historia'
      })
    }

    logger.info('✅ Permisos verificados correctamente:', {
      storyUser: storyUserId,
      requestUser: requestUserId,
      match: storyUserId === requestUserId
    })

    logger.info('🗑️ Antes de softDelete - Story ID:', story._id)
    logger.info('🗑️ Antes de softDelete - isDeleted:', story.isDeleted)

    // Ejecutar softDelete
    const result = await story.softDelete()

    logger.info('🗑️ Después de softDelete - Resultado:', result)
    logger.info('🗑️ Después de softDelete - isDeleted:', result.isDeleted)
    logger.info('🗑️ Después de softDelete - Story guardada:', result._id)

    // Invalidar caché relacionado
    const cacheKey = getStoriesCacheKey(story.user, false)
    await cache.del(cacheKey)
    await cache.del(getFeedCacheKey())

    // Verificar directamente en la base de datos si se guardó
    const storyFromDB = await Story.findById(story._id)
    logger.info('🗑️ Verificación directa en BD:', {
      id: storyFromDB._id,
      isDeleted: storyFromDB.isDeleted,
      updatedAt: storyFromDB.updatedAt
    })

    res.json({
      success: true,
      message: 'Historia eliminada exitosamente'
    })
  } catch (error) {
    logger.error('Error en deleteStory:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Limpiar historias expiradas (tarea programada)
export const cleanupExpiredStories = async (req, res) => {
  try {
    const result = await Story.cleanupExpiredStories()

    res.json({
      success: true,
      message: 'Limpieza de historias expiradas completada',
      result
    })
  } catch (error) {
    logger.error('Error en cleanupExpiredStories:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener usuarios con stories para la barra de stories
export const getUsersWithStories = async (req, res) => {
  try {
    const userId = req.userId

    // Validar que el userId existe
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      })
    }

    // Obtener el usuario actual para incluir sus stories
    const currentUser = await User.findById(userId).select('following').lean()
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    // Obtener usuarios seguidos
    const following = currentUser.following || []

    // Buscar stories activas (no expiradas) de usuarios seguidos + propio usuario
    const query = {
      isDeleted: false,
      isPublic: true,
      expiresAt: { $gt: new Date() },
      user: { $in: [userId, ...following] }
    }

    // Logging optimizado - solo en desarrollo y con menos detalle
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔍 Query para buscar stories:', JSON.stringify(query, null, 2))
      logger.debug('🔍 Usuario actual ID:', userId)
      logger.debug('🔍 Usuarios seguidos:', following)
    }

    const activeStories = await Story.find(query)
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .lean() // Usar lean() para mejor rendimiento

    if (process.env.NODE_ENV === 'development') {
      logger.debug('📊 Stories encontradas:', activeStories.length)
    }

    // Agrupar stories por usuario
    const usersMap = new Map()

    activeStories.forEach(story => {
      const userId = story.user._id.toString()
      if (!usersMap.has(userId)) {
        usersMap.set(userId, {
          _id: story.user._id,
          username: story.user.username,
          avatar: story.user.avatar,
          fullName: story.user.fullName,
          latestStory: story,
          storiesCount: 0
        })
      }
      usersMap.get(userId).storiesCount++
    })

    // Convertir a array y ordenar por la story más reciente
    const usersWithStories = Array.from(usersMap.values())
      .sort((a, b) => new Date(b.latestStory.createdAt) - new Date(a.latestStory.createdAt))

    res.json({
      success: true,
      users: usersWithStories
    })
  } catch (error) {
    logger.error('Error en getUsersWithStories:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// Obtener estadísticas de notificaciones de historias
export const getStoryNotificationStats = async (req, res) => {
  try {
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      })
    }

    // Obtener estadísticas de notificaciones relacionadas con historias
    const stats = await Notification.aggregate([
      {
        $match: {
          user: userId,
          type: { $in: ['story_view', 'story_reaction', 'story_reply'] },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          unreadCount: {
            $sum: { $cond: ['$isRead', 0, 1] }
          }
        }
      }
    ])

    // Formatear estadísticas
    const formattedStats = {
      total: stats.reduce((sum, stat) => sum + stat.count, 0),
      unread: stats.reduce((sum, stat) => sum + stat.unreadCount, 0),
      byType: {}
    }

    stats.forEach(stat => {
      formattedStats.byType[stat._id] = {
        total: stat.count,
        unread: stat.unreadCount
      }
    })

    res.json({
      success: true,
      stats: formattedStats
    })
  } catch (error) {
    logger.error('Error en getStoryNotificationStats:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Marcar notificaciones de historias como leídas
export const markStoryNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      })
    }

    // Marcar todas las notificaciones de historias como leídas
    const result = await Notification.updateMany(
      {
        user: userId,
        type: { $in: ['story_view', 'story_reaction', 'story_reply'] },
        isRead: false,
        isDeleted: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    )

    res.json({
      success: true,
      message: 'Notificaciones de historias marcadas como leídas',
      updatedCount: result.modifiedCount
    })
  } catch (error) {
    logger.error('Error en markStoryNotificationsAsRead:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
