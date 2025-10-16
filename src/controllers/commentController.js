import Comment from '../models/Comment.js'
import Post from '../models/Post.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import { validationResult } from 'express-validator'
import mongoose from 'mongoose'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import {
  createPaginatedResponse,
  getCommentPopulateOptions,
  getPaginationOptions
} from '../utils/queryOptimizer.js'

// Crear un comentario
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

    const { content, parentComment } = req.body
    const { postId } = req.params

    // Validar que postId es un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de publicación inválido'
      })
    }

    // Verificar que el post existe
    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    const commentData = {
      user: req.user.id,
      post: postId,
      content: content.trim()
    }

    // Si es una respuesta a otro comentario
    if (parentComment) {
      // Validar que parentComment es un ObjectId válido
      if (!mongoose.Types.ObjectId.isValid(parentComment)) {
        return res.status(400).json({
          success: false,
          message: 'ID de comentario padre inválido'
        })
      }

      const parent = await Comment.findById(parentComment)
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Comentario padre no encontrado'
        })
      }
      commentData.parentComment = parentComment
    }

    const comment = new Comment(commentData)
    await comment.save()

    // Invalidar caché de comentarios
    await cache.deletePattern(`comments:${postId}:*`)

    // Populate user data
    await comment.populate('user', 'username avatar fullName')

    // Notificar al dueño del post si no es el mismo usuario
    if (post.user.toString() !== req.user.id) {
      await Notification.create({
        user: post.user,
        type: 'comment',
        from: req.user.id,
        post: postId,
        comment: comment._id,
        message: 'Comentó en tu publicación'
      })
    }

    res.status(201).json({
      success: true,
      message: 'Comentario creado exitosamente',
      comment
    })
  } catch (error) {
    logger.error('Error en createComment:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener comentarios de un post
export const getComments = async (req, res) => {
  try {
    const { postId } = req.params

    logger.info('getComments - Recibido postId:', { postId, type: typeof postId })

    // Validar que postId es un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      logger.warn('getComments - ObjectId inválido:', { postId })
      return res.status(400).json({
        success: false,
        message: 'ID de publicación inválido'
      })
    }

    const { page, limit, skip } = getPaginationOptions(
      req.query.page,
      req.query.limit
    )

    logger.info('getComments llamado:', { postId, page, limit, skip })

    // Implementar caché para mejorar rendimiento
    const cacheKey = `comments:${postId}:${page}:${limit}`
    logger.info('Cache key generado:', { cacheKey })

    // Verificar que el post existe
    const post = await Post.findById(postId).select('_id').lean()
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      })
    }

    // Query optimizada
    const query = {
      post: postId,
      isDeleted: false,
      parentComment: null
    }

    // Obtener opciones de población optimizadas
    const populateOptions = getCommentPopulateOptions()

    // Ejecutar queries en paralelo
    const [comments, total] = await Promise.all([
      Comment.find(query)
        .populate('user', populateOptions.userFields)
        .populate('replies', populateOptions.replyFields)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(query)
    ])

    // Crear respuesta paginada usando la función optimizada
    const response = createPaginatedResponse(comments, total, page, limit)

    // Guardar en caché por 1 minuto
    await cache.set(cacheKey, response, 60)

    logger.info('getComments respuesta:', {
      success: response.success,
      commentsCount: response.posts.length, // Nota: posts contiene los comentarios debido a createPaginatedResponse
      total: response.pagination.total
    })

    res.json(response)
  } catch (error) {
    logger.error('Error en getComments:', {
      error: error.message,
      stack: error.stack,
      postId: req.params.postId,
      query: req.query
    })
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener respuestas de un comentario
export const getReplies = async (req, res) => {
  try {
    const { commentId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 5
    const skip = (page - 1) * limit

    // Verificar que el comentario existe
    const comment = await Comment.findById(commentId)
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    const replies = await Comment.findReplies(commentId)
      .skip(skip)
      .limit(limit)

    const total = await Comment.countDocuments({
      parentComment: commentId,
      isDeleted: false
    })

    res.json({
      success: true,
      replies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getReplies:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Dar/quitar like a un comentario
export const toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId)

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    const userId = req.user.id
    const isLiked = comment.isLikedBy(userId)

    if (isLiked) {
      await comment.removeLike(userId)
    } else {
      await comment.addLike(userId)

      // Notificar al dueño del comentario si no es el mismo usuario
      if (comment.user.toString() !== userId) {
        await Notification.create({
          user: comment.user,
          type: 'comment_like',
          from: userId,
          post: comment.post,
          comment: comment._id,
          message: 'Le ha gustado tu comentario'
        })
      }
    }

    res.json({
      success: true,
      liked: !isLiked,
      likesCount: comment.likes.length
    })
  } catch (error) {
    logger.error('Error en toggleLike:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Actualizar un comentario
export const updateComment = async (req, res) => {
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
    const comment = await Comment.findById(req.params.commentId)

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    // Verificar que el usuario sea el dueño del comentario
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este comentario'
      })
    }

    comment.content = content.trim()
    comment.isEdited = true
    await comment.save()

    await comment.populate('user', 'username avatar fullName')

    res.json({
      success: true,
      message: 'Comentario actualizado exitosamente',
      comment
    })
  } catch (error) {
    logger.error('Error en updateComment:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Eliminar un comentario
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId)

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado'
      })
    }

    // Verificar que el usuario sea el dueño del comentario o del post
    const post = await Post.findById(comment.post)
    const isOwner = comment.user.toString() === req.user.id
    const isPostOwner = post && post.user.toString() === req.user.id

    if (!isOwner && !isPostOwner) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este comentario'
      })
    }

    await comment.softDelete()

    res.json({
      success: true,
      message: 'Comentario eliminado exitosamente'
    })
  } catch (error) {
    logger.error('Error en deleteComment:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}

// Obtener comentarios de un usuario
export const getUserComments = async (req, res) => {
  try {
    const { username } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const user = await User.findOne({ username })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      })
    }

    const comments = await Comment.find({
      user: user._id,
      isDeleted: false,
      parentComment: null
    })
      .populate('user', 'username avatar fullName')
      .populate('post', 'caption content')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Comment.countDocuments({
      user: user._id,
      isDeleted: false,
      parentComment: null
    })

    res.json({
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    logger.error('Error en getUserComments:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
}
