/**
 * PostRepository Interface - Domain Layer
 * Define el contrato para el repositorio de posts
 * Implementa el patrón Repository para inversión de dependencias
 */

import { Post } from '../entities/Post.js'

export class PostRepository {
  /**
   * Buscar post por ID
   * @param {string} id - ID del post
   * @returns {Promise<Post|null>} Post encontrado o null
   */
  async findById(id) {
    throw new Error('Método findById debe ser implementado')
  }

  /**
   * Buscar múltiples posts por IDs
   * @param {string[]} ids - Array de IDs de posts
   * @returns {Promise<Post[]>} Array de posts encontrados
   */
  async findByIds(ids) {
    throw new Error('Método findByIds debe ser implementado')
  }

  /**
   * Buscar posts por usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByUserId(userId, options = {}) {
    throw new Error('Método findByUserId debe ser implementado')
  }

  /**
   * Buscar posts por múltiples usuarios (feed)
   * @param {string[]} userIds - Array de IDs de usuarios
   * @param {Object} options - Opciones de paginación y filtrado
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByUserIds(userIds, options = {}) {
    throw new Error('Método findByUserIds debe ser implementado')
  }

  /**
   * Buscar posts por criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación y ordenamiento
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByCriteria(criteria, options = {}) {
    throw new Error('Método findByCriteria debe ser implementado')
  }

  /**
   * Buscar posts por texto (búsqueda)
   * @param {string} searchText - Texto de búsqueda
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Post[]>} Array de posts encontrados
   */
  async search(searchText, options = {}) {
    throw new Error('Método search debe ser implementado')
  }

  /**
   * Buscar posts por tags
   * @param {string[]} tags - Array de tags
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async findByTags(tags, options = {}) {
    throw new Error('Método findByTags debe ser implementado')
  }

  /**
   * Obtener posts populares
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Post[]>} Array de posts populares
   */
  async getPopularPosts(options = {}) {
    throw new Error('Método getPopularPosts debe ser implementado')
  }

  /**
   * Obtener posts trending
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Post[]>} Array de posts trending
   */
  async getTrendingPosts(options = {}) {
    throw new Error('Método getTrendingPosts debe ser implementado')
  }

  /**
   * Obtener posts recientes
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<Post[]>} Array de posts recientes
   */
  async getRecentPosts(options = {}) {
    throw new Error('Método getRecentPosts debe ser implementado')
  }

  /**
   * Guardar un post (crear o actualizar)
   * @param {Post} post - Entidad de post
   * @returns {Promise<Post>} Post guardado
   */
  async save(post) {
    throw new Error('Método save debe ser implementado')
  }

  /**
   * Crear un nuevo post
   * @param {Object} postData - Datos del post
   * @returns {Promise<Post>} Post creado
   */
  async create(postData) {
    throw new Error('Método create debe ser implementado')
  }

  /**
   * Actualizar un post existente
   * @param {string} id - ID del post
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Post>} Post actualizado
   */
  async update(id, updateData) {
    throw new Error('Método update debe ser implementado')
  }

  /**
   * Eliminar un post
   * @param {string} id - ID del post a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    throw new Error('Método delete debe ser implementado')
  }

  /**
   * Dar like a un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que da like
   * @returns {Promise<Post>} Post actualizado
   */
  async addLike(postId, userId) {
    throw new Error('Método addLike debe ser implementado')
  }

  /**
   * Quitar like de un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario que quita like
   * @returns {Promise<Post>} Post actualizado
   */
  async removeLike(postId, userId) {
    throw new Error('Método removeLike debe ser implementado')
  }

  /**
   * Verificar si un usuario dio like a un post
   * @param {string} postId - ID del post
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} True si el usuario dio like
   */
  async hasUserLiked(postId, userId) {
    throw new Error('Método hasUserLiked debe ser implementado')
  }

  /**
   * Obtener likes de un post
   * @param {string} postId - ID del post
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{users: Object[], total: number, page: number, limit: number}>}
   */
  async getLikes(postId, options = {}) {
    throw new Error('Método getLikes debe ser implementado')
  }

  /**
   * Agregar comentario a un post
   * @param {string} postId - ID del post
   * @param {Object} commentData - Datos del comentario
   * @returns {Promise<Post>} Post actualizado
   */
  async addComment(postId, commentData) {
    throw new Error('Método addComment debe ser implementado')
  }

  /**
   * Eliminar comentario de un post
   * @param {string} postId - ID del post
   * @param {string} commentId - ID del comentario
   * @returns {Promise<Post>} Post actualizado
   */
  async removeComment(postId, commentId) {
    throw new Error('Método removeComment debe ser implementado')
  }

  /**
   * Obtener comentarios de un post
   * @param {string} postId - ID del post
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{comments: Object[], total: number, page: number, limit: number}>}
   */
  async getComments(postId, options = {}) {
    throw new Error('Método getComments debe ser implementado')
  }

  /**
   * Incrementar contador de views
   * @param {string} postId - ID del post
   * @returns {Promise<Post>} Post actualizado
   */
  async incrementViews(postId) {
    throw new Error('Método incrementViews debe ser implementado')
  }

  /**
   * Incrementar contador de shares
   * @param {string} postId - ID del post
   * @returns {Promise<Post>} Post actualizado
   */
  async incrementShares(postId) {
    throw new Error('Método incrementShares debe ser implementado')
  }

  /**
   * Obtener posts relacionados
   * @param {string} postId - ID del post
   * @param {number} limit - Límite de posts relacionados
   * @returns {Promise<Post[]>} Array de posts relacionados
   */
  async getRelatedPosts(postId, limit = 5) {
    throw new Error('Método getRelatedPosts debe ser implementado')
  }

  /**
   * Obtener estadísticas de un post
   * @param {string} postId - ID del post
   * @returns {Promise<Object>} Estadísticas del post
   */
  async getStats(postId) {
    throw new Error('Método getStats debe ser implementado')
  }

  /**
   * Obtener posts reportados
   * @param {Object} options - Opciones de filtrado y paginación
   * @returns {Promise<{posts: Post[], total: number, page: number, limit: number}>}
   */
  async getReportedPosts(options = {}) {
    throw new Error('Método getReportedPosts debe ser implementado')
  }

  /**
   * Contar posts totales
   * @param {Object} criteria - Criterios de conteo
   * @returns {Promise<number>} Número total de posts
   */
  async count(criteria = {}) {
    throw new Error('Método count debe ser implementado')
  }

  /**
   * Obtener posts por rango de fechas
   * @param {Date} startDate - Fecha de inicio
   * @param {Date} endDate - Fecha de fin
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Post[]>} Array de posts en el rango
   */
  async getPostsByDateRange(startDate, endDate, options = {}) {
    throw new Error('Método getPostsByDateRange debe ser implementado')
  }

  /**
   * Obtener posts más populares por período
   * @param {string} period - Período (day, week, month, year)
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Post[]>} Array de posts populares
   */
  async getTopPostsByPeriod(period, limit = 10) {
    throw new Error('Método getTopPostsByPeriod debe ser implementado')
  }
}
