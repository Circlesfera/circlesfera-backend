/**
 * UserRepository Interface - Domain Layer
 * Define el contrato para el repositorio de usuarios
 * Implementa el patrón Repository para inversión de dependencias
 */

import { User } from '../entities/User.js'

export class UserRepository {
  /**
   * Buscar usuario por ID
   * @param {string} id - ID del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findById(id) {
    throw new Error('Método findById debe ser implementado')
  }

  /**
   * Buscar usuario por username
   * @param {string} username - Username del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByUsername(username) {
    throw new Error('Método findByUsername debe ser implementado')
  }

  /**
   * Buscar usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByEmail(email) {
    throw new Error('Método findByEmail debe ser implementado')
  }

  /**
   * Buscar múltiples usuarios por IDs
   * @param {string[]} ids - Array de IDs de usuarios
   * @returns {Promise<User[]>} Array de usuarios encontrados
   */
  async findByIds(ids) {
    throw new Error('Método findByIds debe ser implementado')
  }

  /**
   * Buscar usuarios por criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación y ordenamiento
   * @returns {Promise<{users: User[], total: number, page: number, limit: number}>}
   */
  async findByCriteria(criteria, options = {}) {
    throw new Error('Método findByCriteria debe ser implementado')
  }

  /**
   * Buscar usuarios por texto (búsqueda)
   * @param {string} searchText - Texto de búsqueda
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<User[]>} Array de usuarios encontrados
   */
  async search(searchText, options = {}) {
    throw new Error('Método search debe ser implementado')
  }

  /**
   * Verificar si un username está disponible
   * @param {string} username - Username a verificar
   * @param {string} excludeUserId - ID de usuario a excluir de la búsqueda
   * @returns {Promise<boolean>} True si está disponible
   */
  async isUsernameAvailable(username, excludeUserId = null) {
    throw new Error('Método isUsernameAvailable debe ser implementado')
  }

  /**
   * Verificar si un email está disponible
   * @param {string} email - Email a verificar
   * @param {string} excludeUserId - ID de usuario a excluir de la búsqueda
   * @returns {Promise<boolean>} True si está disponible
   */
  async isEmailAvailable(email, excludeUserId = null) {
    throw new Error('Método isEmailAvailable debe ser implementado')
  }

  /**
   * Guardar un usuario (crear o actualizar)
   * @param {User} user - Entidad de usuario
   * @returns {Promise<User>} Usuario guardado
   */
  async save(user) {
    throw new Error('Método save debe ser implementado')
  }

  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<User>} Usuario creado
   */
  async create(userData) {
    throw new Error('Método create debe ser implementado')
  }

  /**
   * Actualizar un usuario existente
   * @param {string} id - ID del usuario
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async update(id, updateData) {
    throw new Error('Método update debe ser implementado')
  }

  /**
   * Eliminar un usuario
   * @param {string} id - ID del usuario a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    throw new Error('Método delete debe ser implementado')
  }

  /**
   * Obtener seguidores de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{users: User[], total: number, page: number, limit: number}>}
   */
  async getFollowers(userId, options = {}) {
    throw new Error('Método getFollowers debe ser implementado')
  }

  /**
   * Obtener usuarios seguidos por un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{users: User[], total: number, page: number, limit: number}>}
   */
  async getFollowing(userId, options = {}) {
    throw new Error('Método getFollowing debe ser implementado')
  }

  /**
   * Obtener sugerencias de usuarios para seguir
   * @param {string} userId - ID del usuario
   * @param {number} limit - Límite de sugerencias
   * @returns {Promise<User[]>} Array de usuarios sugeridos
   */
  async getSuggestions(userId, limit = 10) {
    throw new Error('Método getSuggestions debe ser implementado')
  }

  /**
   * Actualizar contadores de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} counters - Contadores a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async updateCounters(userId, counters) {
    throw new Error('Método updateCounters debe ser implementado')
  }

  /**
   * Incrementar contador de posts
   * @param {string} userId - ID del usuario
   * @returns {Promise<User>} Usuario actualizado
   */
  async incrementPostsCount(userId) {
    throw new Error('Método incrementPostsCount debe ser implementado')
  }

  /**
   * Decrementar contador de posts
   * @param {string} userId - ID del usuario
   * @returns {Promise<User>} Usuario actualizado
   */
  async decrementPostsCount(userId) {
    throw new Error('Método decrementPostsCount debe ser implementado')
  }

  /**
   * Obtener estadísticas de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Estadísticas del usuario
   */
  async getStats(userId) {
    throw new Error('Método getStats debe ser implementado')
  }

  /**
   * Obtener usuarios activos recientemente
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<User[]>} Array de usuarios activos
   */
  async getRecentActiveUsers(options = {}) {
    throw new Error('Método getRecentActiveUsers debe ser implementado')
  }

  /**
   * Contar usuarios totales
   * @param {Object} criteria - Criterios de conteo
   * @returns {Promise<number>} Número total de usuarios
   */
  async count(criteria = {}) {
    throw new Error('Método count debe ser implementado')
  }

  /**
   * Obtener usuarios con más seguidores
   * @param {number} limit - Límite de resultados
   * @returns {Promise<User[]>} Array de usuarios populares
   */
  async getTopUsers(limit = 10) {
    throw new Error('Método getTopUsers debe ser implementado')
  }
}
