/**
 * 💬 REFACTORED COMMENT CONTROLLER
 * ================================
 * Controlador de comentarios refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import Comment from '../models/Comment.js'
import Post from '../models/Post.js'
import Notification from '../models/Notification.js'
import User from '../models/User.js'
import logger from '../utils/logger.js'
import cache from '../utils/cache.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class CommentController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para crear comentario
  static createCommentValidations = [
    body('content')
      .isLength({ min: 1, max: 500 })
      .withMessage('El comentario debe tener entre 1 y 500 caracteres')
      .trim(),
    body('parentComment')
      .optional()
      .isMongoId()
      .withMessage('ID de comentario padre inválido')
  ]

  // Validaciones para actualizar comentario
  static updateCommentValidations = [
    body('content')
      .isLength({ min: 1, max: 500 })
      .withMessage('El comentario debe tener entre 1 y 500 caracteres')
      .trim()
  ]

  /**
   * Crear un comentario
   */
  async createComment(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { content, parentComment } = req.body
      const { postId } = req.params
      const { userId } = req

      // Verificar ObjectId del post
      if (!this.validateObjectId(postId)) {
        return CommentController.error(res, 'ID de publicación inválido', 400)
      }

      // Verificar que el post existe
      const post = await Post.findById(postId)
      if (!post) {
        return CommentController.error(res, 'Publicación no encontrada', 404)
      }

      // Si es respuesta a otro comentario, verificar que existe
      let parentCommentDoc = null
      if (parentComment) {
        if (!this.validateObjectId(parentComment)) {
          return CommentController.error(res, 'ID de comentario padre inválido', 400)
        }

        parentCommentDoc = await Comment.findById(parentComment)
        if (!parentCommentDoc) {
          return CommentController.error(res, 'Comentario padre no encontrado', 404)
        }

        // Verificar que el comentario padre pertenece al mismo post
        if (parentCommentDoc.post.toString() !== postId) {
          return CommentController.error(res, 'El comentario padre no pertenece a esta publicación', 400)
        }
      }

      // Crear comentario
      const commentData = {
        user: userId,
        post: postId,
        content: content.trim(),
        parentComment: parentComment || null
      }

      const comment = new Comment(commentData)
      await comment.save()

      // Poblar datos del usuario
      await comment.populate('user', 'username fullName avatar')

      // Incrementar contador de comentarios del post
      await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } })

      // Si es respuesta, incrementar contador del comentario padre
      if (parentComment) {
        await Comment.findByIdAndUpdate(parentComment, { $inc: { repliesCount: 1 } })
      }

      // Crear notificación si no es comentario propio
      if (post.user.toString() !== userId) {
        await Notification.create({
          user: post.user,
          type: 'comment',
          fromUser: userId,
          post: postId,
          comment: comment._id,
          message: 'comentó tu publicación'
        })
      }

      // Limpiar cache
      await cache.del(`post:${postId}`)
      await cache.del(`comments:${postId}:*`)

      logger.info('Comentario creado exitosamente', { commentId: comment._id, postId, userId })

      return CommentController.success(res, comment, 'Comentario creado exitosamente', 201)

    } catch (error) {
      logger.error('Error creando comentario:', error)
      return CommentController.handleError(res, error)
    }
  }

  /**
   * Obtener comentarios de un post
   */
  async getComments(req, res) {
    try {
      const { postId } = req.params
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar ObjectId del post
      if (!this.validateObjectId(postId)) {
        return CommentController.error(res, 'ID de publicación inválido', 400)
      }

      // Verificar que el post existe
      const post = await Post.findById(postId)
      if (!post) {
        return CommentController.error(res, 'Publicación no encontrada', 404)
      }

      // Verificar cache
      const cacheKey = `comments:${postId}:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedComments = await cache.get(cacheKey)

      if (cachedComments) {
        return CommentController.success(res, JSON.parse(cachedComments), 'Comentarios obtenidos del cache')
      }

      // Obtener comentarios principales (no respuestas)
      const comments = await Comment.find({
        post: postId,
        parentComment: null,
        isDeleted: false
      })
        .populate('user', 'username fullName avatar')
        .populate('likes', 'username')
        .sort({ createdAt: -1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)
        .lean()

      // Para cada comentario principal, obtener las primeras respuestas
      for (const comment of comments) {
        comment.replies = await Comment.find({
          parentComment: comment._id,
          isDeleted: false
        })
          .populate('user', 'username fullName avatar')
          .sort({ createdAt: 1 })
          .limit(3)
          .lean()
      }

      const total = await Comment.countDocuments({
        post: postId,
        parentComment: null,
        isDeleted: false
      })

      const response = this.createPaginatedResponse(comments, paginationOptions, total)

      // Cachear resultado
      await cache.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      logger.info('Comentarios obtenidos exitosamente', { postId, count: comments.length })

      return CommentController.success(res, response, 'Comentarios obtenidos exitosamente')

    } catch (error) {
      logger.error('Error obteniendo comentarios:', error)
      return CommentController.handleError(res, error)
    }
  }

  /**
   * Obtener respuestas de un comentario
   */
  async getCommentReplies(req, res) {
    try {
      const { commentId } = req.params
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar ObjectId del comentario
      if (!this.validateObjectId(commentId)) {
        return CommentController.error(res, 'ID de comentario inválido', 400)
      }

      // Verificar que el comentario existe
      const parentComment = await Comment.findById(commentId)
      if (!parentComment) {
        return CommentController.error(res, 'Comentario no encontrado', 404)
      }

      // Verificar cache
      const cacheKey = `comment_replies:${commentId}:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedReplies = await cache.get(cacheKey)

      if (cachedReplies) {
        return CommentController.success(res, JSON.parse(cachedReplies), 'Respuestas obtenidas del cache')
      }

      // Obtener respuestas
      const replies = await Comment.find({
        parentComment: commentId,
        isDeleted: false
      })
        .populate('user', 'username fullName avatar')
        .populate('likes', 'username')
        .sort({ createdAt: 1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)
        .lean()

      const total = await Comment.countDocuments({
        parentComment: commentId,
        isDeleted: false
      })

      const response = this.createPaginatedResponse(replies, paginationOptions, total)

      // Cachear resultado
      await cache.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      return CommentController.success(res, response, 'Respuestas obtenidas exitosamente')

    } catch (error) {
      logger.error('Error obteniendo respuestas:', error)
      return CommentController.handleError(res, error)
    }
  }

  /**
   * Actualizar comentario
   */
  async updateComment(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { commentId } = req.params
      const { userId } = req
      const { content } = req.body

      // Verificar ObjectId del comentario
      if (!this.validateObjectId(commentId)) {
        return CommentController.error(res, 'ID de comentario inválido', 400)
      }

      // Verificar que el comentario existe y pertenece al usuario
      const ownershipError = await this.validateOwnership(Comment, commentId, userId, res)
      if (ownershipError) {
        return ownershipError
      }

      const comment = await Comment.findByIdAndUpdate(
        commentId,
        { content: content.trim(), editedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('user', 'username fullName avatar')

      // Limpiar cache
      await cache.del(`comment:${commentId}`)
      await cache.del(`comments:${comment.post}:*`)

      logger.info('Comentario actualizado exitosamente', { commentId, userId })

      return CommentController.success(res, comment, 'Comentario actualizado exitosamente')

    } catch (error) {
      logger.error('Error actualizando comentario:', error)
      return CommentController.handleError(res, error)
    }
  }

  /**
   * Eliminar comentario
   */
  async deleteComment(req, res) {
    try {
      const { commentId } = req.params
      const { userId } = req

      // Verificar ObjectId del comentario
      if (!this.validateObjectId(commentId)) {
        return CommentController.error(res, 'ID de comentario inválido', 400)
      }

      // Verificar que el comentario existe y pertenece al usuario
      const ownershipError = await this.validateOwnership(Comment, commentId, userId, res)
      if (ownershipError) {
        return ownershipError
      }

      const comment = await Comment.findById(commentId)

      // Soft delete
      await Comment.findByIdAndUpdate(commentId, {
        isDeleted: true,
        deletedAt: new Date(),
        content: '[Comentario eliminado]'
      })

      // Decrementar contador de comentarios del post
      await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } })

      // Si es respuesta, decrementar contador del comentario padre
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } })
      }

      // Limpiar cache
      await cache.del(`comment:${commentId}`)
      await cache.del(`comments:${comment.post}:*`)

      logger.info('Comentario eliminado exitosamente', { commentId, userId })

      return CommentController.success(res, null, 'Comentario eliminado exitosamente')

    } catch (error) {
      logger.error('Error eliminando comentario:', error)
      return CommentController.handleError(res, error)
    }
  }

  /**
   * Like/Unlike comentario
   */
  async toggleLike(req, res) {
    try {
      const { commentId } = req.params
      const { userId } = req

      // Verificar ObjectId del comentario
      if (!this.validateObjectId(commentId)) {
        return CommentController.error(res, 'ID de comentario inválido', 400)
      }

      const comment = await Comment.findById(commentId)
      if (!comment) {
        return CommentController.error(res, 'Comentario no encontrado', 404)
      }

      const isLiked = comment.likes.includes(userId)

      if (isLiked) {
        // Unlike
        comment.likes.pull(userId)
      } else {
        // Like
        comment.likes.push(userId)
      }

      await comment.save()

      // Crear notificación si es like y no es comentario propio
      if (!isLiked && comment.user.toString() !== userId) {
        await Notification.create({
          user: comment.user,
          type: 'like',
          fromUser: userId,
          comment: comment._id,
          message: 'le gustó tu comentario'
        })
      }

      // Limpiar cache
      await cache.del(`comment:${commentId}`)
      await cache.del(`comments:${comment.post}:*`)

      logger.info(`Comentario ${isLiked ? 'unliked' : 'liked'} exitosamente`, { commentId, userId })

      return CommentController.success(res, {
        isLiked: !isLiked,
        likesCount: comment.likes.length
      }, `Comentario ${isLiked ? 'unliked' : 'liked'} exitosamente`)

    } catch (error) {
      logger.error('Error toggling like en comentario:', error)
      return CommentController.handleError(res, error)
    }
  }
}

export const commentController = new CommentController()

// Exportar las validaciones para uso en rutas
export {
  CommentController
}
