/**
 * MongoosePostRepository - Infrastructure Layer
 * Implementación del repositorio de posts usando Mongoose
 * Implementa la interfaz PostRepository del dominio
 */

import { PostRepository } from '../../../domain/repositories/PostRepository.js'
import { Post } from '../../../domain/entities/Post.js'
import PostModel from '../../models/Post.js'
import { logger } from '../../utils/logger.js'

export class MongoosePostRepository extends PostRepository {
  constructor() {
    super()
  }

  /**
   * Buscar post por ID
   * @param {string} id - ID del post
   * @returns {Promise<Post|null>} Post encontrado o null
   */
  async findById(id) {
    try {
      const postDoc = await PostModel.findById(id).lean()
      return postDoc ? this.toDomain(postDoc) : null
    } catch (error) {
      logger.error('Error en findById', {
        error: error.message,
        postId: id
      })
      throw new Error('Error obteniendo post')
    }
  }

  /**
   * Buscar múltiples posts por IDs
   * @param {string[]} ids - Array de IDs de posts
   * @returns {Promise<Post[]>} Array de posts encontrados
   */
  async findByIds(ids) {
    try {
      const postDocs = await PostModel.find({
        _id: { $in: ids }
      }).lean()

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en findByIds', {
        error: error.message,
        ids
      })
      throw new Error('Error obteniendo posts por IDs')
    }
  }

  /**
   * Buscar posts por usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByUserId(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 },
        type = null,
        ...filters
      } = options

      const query = { userId, isActive: true, ...filters }
      if (type) {
        query.type = type
      }

      const skip = (page - 1) * limit

      const [postDocs, total] = await Promise.all([
        PostModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        PostModel.countDocuments(query)
      ])

      const posts = postDocs.map(doc => this.toDomain(doc))

      return {
        posts,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en findByUserId', {
        error: error.message,
        userId,
        options
      })
      throw new Error('Error obteniendo posts por usuario')
    }
  }

  /**
   * Buscar posts por múltiples usuarios (feed)
   * @param {string[]} userIds - Array de IDs de usuarios
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByUserIds(userIds, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 },
        type = null,
        ...filters
      } = options

      const query = { userId: { $in: userIds }, isActive: true, ...filters }
      if (type) {
        query.type = type
      }

      const skip = (page - 1) * limit

      const [postDocs, total] = await Promise.all([
        PostModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        PostModel.countDocuments(query)
      ])

      const posts = postDocs.map(doc => this.toDomain(doc))

      return {
        posts,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en findByUserIds', {
        error: error.message,
        userIds,
        options
      })
      throw new Error('Error obteniendo posts por usuarios')
    }
  }

  /**
   * Buscar posts por criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación y ordenamiento
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByCriteria(criteria, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 },
        ...filters
      } = options

      const query = { ...criteria, isActive: true, ...filters }
      const skip = (page - 1) * limit

      const [postDocs, total] = await Promise.all([
        PostModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        PostModel.countDocuments(query)
      ])

      const posts = postDocs.map(doc => this.toDomain(doc))

      return {
        posts,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en findByCriteria', {
        error: error.message,
        criteria,
        options
      })
      throw new Error('Error obteniendo posts por criterios')
    }
  }

  /**
   * Buscar posts por texto (búsqueda)
   * @param {string} searchText - Texto de búsqueda
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Post[]>} Array de posts encontrados
   */
  async search(searchText, options = {}) {
    try {
      const { limit = 20 } = options

      const postDocs = await PostModel.find({
        $or: [
          { caption: { $regex: searchText, $options: 'i' } },
          { tags: { $in: [new RegExp(searchText, 'i')] } }
        ],
        isActive: true
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en search', {
        error: error.message,
        searchText,
        options
      })
      throw new Error('Error buscando posts')
    }
  }

  /**
   * Buscar posts por tags
   * @param {string[]} tags - Array de tags
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByTags(tags, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 }
      } = options

      const query = {
        tags: { $in: tags },
        isActive: true
      }

      const skip = (page - 1) * limit

      const [postDocs, total] = await Promise.all([
        PostModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        PostModel.countDocuments(query)
      ])

      const posts = postDocs.map(doc => this.toDomain(doc))

      return {
        posts,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en findByTags', {
        error: error.message,
        tags,
        options
      })
      throw new Error('Error obteniendo posts por tags')
    }
  }

  /**
   * Obtener posts populares
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Post[]>} Array de posts populares
   */
  async getPopularPosts(options = {}) {
    try {
      const { limit = 20, days = 7 } = options

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const postDocs = await PostModel.aggregate([
        {
          $match: {
            isActive: true,
            createdAt: { $gte: startDate }
          }
        },
        {
          $addFields: {
            popularityScore: {
              $add: [
                { $size: '$likes' },
                { $multiply: [{ $size: '$comments' }, 2] },
                { $multiply: ['$views', 0.1] }
              ]
            }
          }
        },
        {
          $sort: { popularityScore: -1 }
        },
        {
          $limit: limit
        }
      ])

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getPopularPosts', {
        error: error.message,
        options
      })
      throw new Error('Error obteniendo posts populares')
    }
  }

  /**
   * Obtener posts trending
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Post[]>} Array de posts trending
   */
  async getTrendingPosts(options = {}) {
    try {
      const { limit = 20, hours = 24 } = options

      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000)

      const postDocs = await PostModel.aggregate([
        {
          $match: {
            isActive: true,
            createdAt: { $gte: startDate }
          }
        },
        {
          $addFields: {
            trendingScore: {
              $add: [
                { $size: '$likes' },
                { $multiply: [{ $size: '$comments' }, 3] },
                { $multiply: ['$views', 0.1] },
                { $multiply: ['$shares', 5] }
              ]
            }
          }
        },
        {
          $sort: { trendingScore: -1 }
        },
        {
          $limit: limit
        }
      ])

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getTrendingPosts', {
        error: error.message,
        options
      })
      throw new Error('Error obteniendo posts trending')
    }
  }

  /**
   * Obtener posts recientes
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Post[]>} Array de posts recientes
   */
  async getRecentPosts(options = {}) {
    try {
      const { limit = 20, type = null } = options

      const query = { isActive: true }
      if (type) {
        query.type = type
      }

      const postDocs = await PostModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getRecentPosts', {
        error: error.message,
        options
      })
      throw new Error('Error obteniendo posts recientes')
    }
  }

  /**
   * Guardar un post (crear o actualizar)
   * @param {Post} post - Entidad de post
   * @returns {Promise<Post>} Post guardado
   */
  async save(post) {
    try {
      const postData = this.toPersistence(post)
      let savedPost

      if (post.id) {
        // Actualizar post existente
        savedPost = await PostModel.findByIdAndUpdate(
          post.id,
          { ...postData, updatedAt: new Date() },
          { new: true, runValidators: true }
        ).lean()
      } else {
        // Crear nuevo post
        const newPost = new PostModel(postData)
        savedPost = await newPost.save()
      }

      return this.toDomain(savedPost)
    } catch (error) {
      logger.error('Error en save', {
        error: error.message,
        postId: post.id
      })
      throw new Error('Error guardando post')
    }
  }

  /**
   * Crear un nuevo post
   * @param {Object} postData - Datos del post
   * @returns {Promise<Post>} Post creado
   */
  async create(postData) {
    try {
      const newPost = new PostModel(postData)
      const savedPost = await newPost.save()
      return this.toDomain(savedPost)
    } catch (error) {
      logger.error('Error en create', {
        error: error.message,
        userId: postData.userId
      })
      throw new Error('Error creando post')
    }
  }

  /**
   * Actualizar un post existente
   * @param {string} id - ID del post
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Post>} Post actualizado
   */
  async update(id, updateData) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en update', {
        error: error.message,
        postId: id
      })
      throw new Error('Error actualizando post')
    }
  }

  /**
   * Eliminar un post
   * @param {string} id - ID del post a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    try {
      const result = await PostModel.findByIdAndDelete(id)
      return !!result
    } catch (error) {
      logger.error('Error en delete', {
        error: error.message,
        postId: id
      })
      throw new Error('Error eliminando post')
    }
  }

  /**
   * Dar like a un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que da like
   * @returns {Promise<Post>} Post actualizado
   */
  async addLike(postId, userId) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        postId,
        { $addToSet: { likes: userId } },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en addLike', {
        error: error.message,
        postId,
        userId
      })
      throw new Error('Error agregando like')
    }
  }

  /**
   * Quitar like de un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que quita like
   * @returns {Promise<Post>} Post actualizado
   */
  async removeLike(postId, userId) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        postId,
        { $pull: { likes: userId } },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en removeLike', {
        error: error.message,
        postId,
        userId
      })
      throw new Error('Error removiendo like')
    }
  }

  /**
   * Verificar si un usuario dio like a un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} True si el usuario dio like
   */
  async hasUserLiked(postId, userId) {
    try {
      const post = await PostModel.findById(postId, 'likes').lean()
      if (!post) {
        throw new Error('Post no encontrado')
      }

      return post.likes.includes(userId)
    } catch (error) {
      logger.error('Error en hasUserLiked', {
        error: error.message,
        postId,
        userId
      })
      throw new Error('Error verificando like')
    }
  }

  /**
   * Obtener likes de un post
   * @param {string} postId - ID del post
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{users: Object[], total: number, page: number, limit: number}>}
   */
  async getLikes(postId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options
      const skip = (page - 1) * limit

      const post = await PostModel.findById(postId)
        .populate({
          path: 'likes',
          select: 'username fullName avatar',
          options: {
            skip,
            limit
          }
        })
        .lean()

      if (!post) {
        throw new Error('Post no encontrado')
      }

      const total = post.likes.length
      const users = post.likes.slice(skip, skip + limit)

      return {
        users,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en getLikes', {
        error: error.message,
        postId,
        options
      })
      throw new Error('Error obteniendo likes')
    }
  }

  /**
   * Agregar comentario a un post
   * @param {string} postId - ID del post
   * @param {Object} commentData - Datos del comentario
   * @returns {Promise<Post>} Post actualizado
   */
  async addComment(postId, commentData) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        postId,
        { $push: { comments: commentData } },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en addComment', {
        error: error.message,
        postId
      })
      throw new Error('Error agregando comentario')
    }
  }

  /**
   * Eliminar comentario de un post
   * @param {string} postId - ID del post
   * @param {string} commentId - ID del comentario
   * @returns {Promise<Post>} Post actualizado
   */
  async removeComment(postId, commentId) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        postId,
        { $pull: { comments: { _id: commentId } } },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en removeComment', {
        error: error.message,
        postId,
        commentId
      })
      throw new Error('Error eliminando comentario')
    }
  }

  /**
   * Obtener comentarios de un post
   * @param {string} postId - ID del post
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{comments: Object[], total: number, page: number, limit: number}>}
   */
  async getComments(postId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options
      const skip = (page - 1) * limit

      const post = await PostModel.findById(postId)
        .populate({
          path: 'comments',
          populate: {
            path: 'userId',
            select: 'username fullName avatar'
          },
          options: {
            skip,
            limit,
            sort: { createdAt: -1 }
          }
        })
        .lean()

      if (!post) {
        throw new Error('Post no encontrado')
      }

      const total = post.comments.length
      const comments = post.comments.slice(skip, skip + limit)

      return {
        comments,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en getComments', {
        error: error.message,
        postId,
        options
      })
      throw new Error('Error obteniendo comentarios')
    }
  }

  /**
   * Incrementar contador de views
   * @param {string} postId - ID del post
   * @returns {Promise<Post>} Post actualizado
   */
  async incrementViews(postId) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        postId,
        { $inc: { views: 1 } },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en incrementViews', {
        error: error.message,
        postId
      })
      throw new Error('Error incrementando views')
    }
  }

  /**
   * Incrementar contador de shares
   * @param {string} postId - ID del post
   * @returns {Promise<Post>} Post actualizado
   */
  async incrementShares(postId) {
    try {
      const updatedPost = await PostModel.findByIdAndUpdate(
        postId,
        { $inc: { shares: 1 } },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedPost) {
        throw new Error('Post no encontrado')
      }

      return this.toDomain(updatedPost)
    } catch (error) {
      logger.error('Error en incrementShares', {
        error: error.message,
        postId
      })
      throw new Error('Error incrementando shares')
    }
  }

  /**
   * Obtener posts relacionados
   * @param {string} postId - ID del post
   * @param {number} limit - Límite de posts relacionados
   * @returns {Promise<Post[]>} Array de posts relacionados
   */
  async getRelatedPosts(postId, limit = 5) {
    try {
      const post = await PostModel.findById(postId).lean()
      if (!post) {
        throw new Error('Post no encontrado')
      }

      const relatedPosts = await PostModel.find({
        _id: { $ne: postId },
        $or: [
          { tags: { $in: post.tags } },
          { userId: post.userId }
        ],
        isActive: true
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      return relatedPosts.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getRelatedPosts', {
        error: error.message,
        postId,
        limit
      })
      throw new Error('Error obteniendo posts relacionados')
    }
  }

  /**
   * Obtener estadísticas de un post
   * @param {string} postId - ID del post
   * @returns {Promise<Object>} Estadísticas del post
   */
  async getStats(postId) {
    try {
      const post = await PostModel.findById(postId).lean()
      if (!post) {
        throw new Error('Post no encontrado')
      }

      return {
        likesCount: post.likes.length,
        commentsCount: post.comments.length,
        sharesCount: post.shares,
        viewsCount: post.views,
        engagementRate: this.calculateEngagementRate(post)
      }
    } catch (error) {
      logger.error('Error en getStats', {
        error: error.message,
        postId
      })
      throw new Error('Error obteniendo estadísticas')
    }
  }

  /**
   * Obtener posts reportados
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async getReportedPosts(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 }
      } = options

      const query = {
        reports: { $exists: true, $not: { $size: 0 } },
        isActive: true
      }

      const skip = (page - 1) * limit

      const [postDocs, total] = await Promise.all([
        PostModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        PostModel.countDocuments(query)
      ])

      const posts = postDocs.map(doc => this.toDomain(doc))

      return {
        posts,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    } catch (error) {
      logger.error('Error en getReportedPosts', {
        error: error.message,
        options
      })
      throw new Error('Error obteniendo posts reportados')
    }
  }

  /**
   * Contar posts totales
   * @param {Object} criteria - Criterios de conteo
   * @returns {Promise<number>} Número total de posts
   */
  async count(criteria = {}) {
    try {
      return await PostModel.countDocuments({ ...criteria, isActive: true })
    } catch (error) {
      logger.error('Error en count', {
        error: error.message,
        criteria
      })
      throw new Error('Error contando posts')
    }
  }

  /**
   * Obtener posts por rango de fechas
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Post[]>} Array de posts en el rango
   */
  async getPostsByDateRange(startDate, endDate, options = {}) {
    try {
      const { limit = 100 } = options

      const postDocs = await PostModel.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        isActive: true,
        ...options
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getPostsByDateRange', {
        error: error.message,
        startDate,
        endDate,
        options
      })
      throw new Error('Error obteniendo posts por rango de fechas')
    }
  }

  /**
   * Obtener posts más populares por período
   * @param {string} period - Período (day, week, month, year)
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Post[]>} Array de posts populares
   */
  async getTopPostsByPeriod(period, limit = 10) {
    try {
      const periods = {
        day: 1,
        week: 7,
        month: 30,
        year: 365
      }

      const days = periods[period] || 7
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const postDocs = await PostModel.aggregate([
        {
          $match: {
            isActive: true,
            createdAt: { $gte: startDate }
          }
        },
        {
          $addFields: {
            popularityScore: {
              $add: [
                { $size: '$likes' },
                { $multiply: [{ $size: '$comments' }, 2] },
                { $multiply: ['$views', 0.1] },
                { $multiply: ['$shares', 3] }
              ]
            }
          }
        },
        {
          $sort: { popularityScore: -1 }
        },
        {
          $limit: limit
        }
      ])

      return postDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getTopPostsByPeriod', {
        error: error.message,
        period,
        limit
      })
      throw new Error('Error obteniendo posts populares por período')
    }
  }

  /**
   * Calcular tasa de engagement
   * @param {Object} post - Post document
   * @returns {number} Tasa de engagement
   */
  calculateEngagementRate(post) {
    const totalEngagement = post.likes.length + post.comments.length + post.shares
    const totalReach = post.views || 1 // Evitar división por cero
    return (totalEngagement / totalReach) * 100
  }

  /**
   * Convertir documento de Mongoose a entidad de dominio
   * @param {Object} doc - Documento de Mongoose
   * @returns {Post} Entidad de post
   */
  toDomain(doc) {
    return new Post({
      id: doc._id.toString(),
      userId: doc.userId,
      type: doc.type,
      caption: doc.caption,
      content: doc.content,
      location: doc.location,
      tags: doc.tags,
      mentions: doc.mentions,
      likes: doc.likes,
      comments: doc.comments,
      shares: doc.shares,
      views: doc.views,
      isPublic: doc.isPublic,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    })
  }

  /**
   * Convertir entidad de dominio a documento de persistencia
   * @param {Post} post - Entidad de post
   * @returns {Object} Documento para persistencia
   */
  toPersistence(post) {
    return {
      userId: post.userId,
      type: post.type,
      caption: post.caption,
      content: post.content,
      location: post.location,
      tags: post.tags,
      mentions: post.mentions,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      views: post.views,
      isPublic: post.isPublic,
      isActive: post.isActive
    }
  }
}
