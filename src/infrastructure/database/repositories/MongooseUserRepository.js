/**
 * MongooseUserRepository - Infrastructure Layer
 * Implementación del repositorio de usuarios usando Mongoose
 * Implementa la interfaz UserRepository del dominio
 */

import { UserRepository } from '../../../domain/repositories/UserRepository.js'
import { User } from '../../../domain/entities/User.js'
import UserModel from '../../models/User.js'
import { logger } from '../../utils/logger.js'

export class MongooseUserRepository extends UserRepository {
  constructor() {
    super()
  }

  /**
   * Buscar usuario por ID
   * @param {string} id - ID del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findById(id) {
    try {
      const userDoc = await UserModel.findById(id).lean()
      return userDoc ? this.toDomain(userDoc) : null
    } catch (error) {
      logger.error('Error en findById', {
        error: error.message,
        userId: id
      })
      throw new Error('Error obteniendo usuario')
    }
  }

  /**
   * Buscar usuario por username
   * @param {string} username - Username del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByUsername(username) {
    try {
      const userDoc = await UserModel.findOne({ username }).lean()
      return userDoc ? this.toDomain(userDoc) : null
    } catch (error) {
      logger.error('Error en findByUsername', {
        error: error.message,
        username
      })
      throw new Error('Error obteniendo usuario por username')
    }
  }

  /**
   * Buscar usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByEmail(email) {
    try {
      const userDoc = await UserModel.findOne({ email }).lean()
      return userDoc ? this.toDomain(userDoc) : null
    } catch (error) {
      logger.error('Error en findByEmail', {
        error: error.message,
        email
      })
      throw new Error('Error obteniendo usuario por email')
    }
  }

  /**
   * Buscar múltiples usuarios por IDs
   * @param {string[]} ids - Array de IDs de usuarios
   * @returns {Promise<User[]>} Array de usuarios encontrados
   */
  async findByIds(ids) {
    try {
      const userDocs = await UserModel.find({
        _id: { $in: ids }
      }).lean()

      return userDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en findByIds', {
        error: error.message,
        ids
      })
      throw new Error('Error obteniendo usuarios por IDs')
    }
  }

  /**
   * Buscar usuarios por criterios
   * @param {Object} criteria - Criterios de búsqueda
   * @param {Object} options - Opciones de paginación y ordenamiento
   * @returns {Promise<{users: User[], total: number, page: number, limit: number}>}
   */
  async findByCriteria(criteria, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 },
        ...filters
      } = options

      const query = { ...criteria, ...filters }
      const skip = (page - 1) * limit

      const [userDocs, total] = await Promise.all([
        UserModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        UserModel.countDocuments(query)
      ])

      const users = userDocs.map(doc => this.toDomain(doc))

      return {
        users,
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
      throw new Error('Error obteniendo usuarios por criterios')
    }
  }

  /**
   * Buscar usuarios por texto (búsqueda)
   * @param {string} searchText - Texto de búsqueda
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<User[]>} Array de usuarios encontrados
   */
  async search(searchText, options = {}) {
    try {
      const { limit = 20 } = options

      const userDocs = await UserModel.find({
        $or: [
          { username: { $regex: searchText, $options: 'i' } },
          { fullName: { $regex: searchText, $options: 'i' } },
          { bio: { $regex: searchText, $options: 'i' } }
        ],
        isActive: true
      })
        .sort({ followersCount: -1 })
        .limit(limit)
        .lean()

      return userDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en search', {
        error: error.message,
        searchText,
        options
      })
      throw new Error('Error buscando usuarios')
    }
  }

  /**
   * Verificar si un username está disponible
   * @param {string} username - Username a verificar
   * @param {string} excludeUserId - ID de usuario a excluir de la búsqueda
   * @returns {Promise<boolean>} True si está disponible
   */
  async isUsernameAvailable(username, excludeUserId = null) {
    try {
      const query = { username }
      if (excludeUserId) {
        query._id = { $ne: excludeUserId }
      }

      const count = await UserModel.countDocuments(query)
      return count === 0
    } catch (error) {
      logger.error('Error en isUsernameAvailable', {
        error: error.message,
        username
      })
      throw new Error('Error verificando disponibilidad de username')
    }
  }

  /**
   * Verificar si un email está disponible
   * @param {string} email - Email a verificar
   * @param {string} excludeUserId - ID de usuario a excluir de la búsqueda
   * @returns {Promise<boolean>} True si está disponible
   */
  async isEmailAvailable(email, excludeUserId = null) {
    try {
      const query = { email }
      if (excludeUserId) {
        query._id = { $ne: excludeUserId }
      }

      const count = await UserModel.countDocuments(query)
      return count === 0
    } catch (error) {
      logger.error('Error en isEmailAvailable', {
        error: error.message,
        email
      })
      throw new Error('Error verificando disponibilidad de email')
    }
  }

  /**
   * Guardar un usuario (crear o actualizar)
   * @param {User} user - Entidad de usuario
   * @returns {Promise<User>} Usuario guardado
   */
  async save(user) {
    try {
      const userData = this.toPersistence(user)
      let savedUser

      if (user.id) {
        // Actualizar usuario existente
        savedUser = await UserModel.findByIdAndUpdate(
          user.id,
          { ...userData, updatedAt: new Date() },
          { new: true, runValidators: true }
        ).lean()
      } else {
        // Crear nuevo usuario
        const newUser = new UserModel(userData)
        savedUser = await newUser.save()
      }

      return this.toDomain(savedUser)
    } catch (error) {
      logger.error('Error en save', {
        error: error.message,
        userId: user.id
      })
      throw new Error('Error guardando usuario')
    }
  }

  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<User>} Usuario creado
   */
  async create(userData) {
    try {
      const newUser = new UserModel(userData)
      const savedUser = await newUser.save()
      return this.toDomain(savedUser)
    } catch (error) {
      logger.error('Error en create', {
        error: error.message,
        username: userData.username
      })
      throw new Error('Error creando usuario')
    }
  }

  /**
   * Actualizar un usuario existente
   * @param {string} id - ID del usuario
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async update(id, updateData) {
    try {
      const updatedUser = await UserModel.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedUser) {
        throw new Error('Usuario no encontrado')
      }

      return this.toDomain(updatedUser)
    } catch (error) {
      logger.error('Error en update', {
        error: error.message,
        userId: id
      })
      throw new Error('Error actualizando usuario')
    }
  }

  /**
   * Eliminar un usuario
   * @param {string} id - ID del usuario a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async delete(id) {
    try {
      const result = await UserModel.findByIdAndDelete(id)
      return !!result
    } catch (error) {
      logger.error('Error en delete', {
        error: error.message,
        userId: id
      })
      throw new Error('Error eliminando usuario')
    }
  }

  /**
   * Obtener seguidores de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{users: User[], total: number, page: number, limit: number}>}
   */
  async getFollowers(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options
      const skip = (page - 1) * limit

      // Aquí implementarías la lógica para obtener seguidores
      // Por ahora retornamos un resultado vacío
      return {
        users: [],
        total: 0,
        page,
        limit,
        pages: 0
      }
    } catch (error) {
      logger.error('Error en getFollowers', {
        error: error.message,
        userId
      })
      throw new Error('Error obteniendo seguidores')
    }
  }

  /**
   * Obtener usuarios seguidos por un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<{users: User[], total: number, page: number, limit: number}>}
   */
  async getFollowing(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options
      const skip = (page - 1) * limit

      // Aquí implementarías la lógica para obtener seguidos
      // Por ahora retornamos un resultado vacío
      return {
        users: [],
        total: 0,
        page,
        limit,
        pages: 0
      }
    } catch (error) {
      logger.error('Error en getFollowing', {
        error: error.message,
        userId
      })
      throw new Error('Error obteniendo seguidos')
    }
  }

  /**
   * Obtener sugerencias de usuarios para seguir
   * @param {string} userId - ID del usuario
   * @param {number} limit - Límite de sugerencias
   * @returns {Promise<User[]>} Array de usuarios sugeridos
   */
  async getSuggestions(userId, limit = 10) {
    try {
      const userDocs = await UserModel.find({
        _id: { $ne: userId },
        isActive: true
      })
        .sort({ followersCount: -1 })
        .limit(limit)
        .lean()

      return userDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getSuggestions', {
        error: error.message,
        userId
      })
      throw new Error('Error obteniendo sugerencias')
    }
  }

  /**
   * Actualizar contadores de un usuario
   * @param {string} userId - ID del usuario
   * @param {Object} counters - Contadores a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async updateCounters(userId, counters) {
    try {
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        { $inc: counters, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).lean()

      if (!updatedUser) {
        throw new Error('Usuario no encontrado')
      }

      return this.toDomain(updatedUser)
    } catch (error) {
      logger.error('Error en updateCounters', {
        error: error.message,
        userId,
        counters
      })
      throw new Error('Error actualizando contadores')
    }
  }

  /**
   * Incrementar contador de posts
   * @param {string} userId - ID del usuario
   * @returns {Promise<User>} Usuario actualizado
   */
  async incrementPostsCount(userId) {
    return this.updateCounters(userId, { postsCount: 1 })
  }

  /**
   * Decrementar contador de posts
   * @param {string} userId - ID del usuario
   * @returns {Promise<User>} Usuario actualizado
   */
  async decrementPostsCount(userId) {
    return this.updateCounters(userId, { postsCount: -1 })
  }

  /**
   * Obtener estadísticas de un usuario
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Estadísticas del usuario
   */
  async getStats(userId) {
    try {
      // Aquí implementarías la lógica para obtener estadísticas
      // Por ahora retornamos estadísticas básicas
      const user = await this.findById(userId)
      if (!user) {
        throw new Error('Usuario no encontrado')
      }

      return {
        postsCount: user.postsCount,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        totalLikes: 0,
        totalViews: 0
      }
    } catch (error) {
      logger.error('Error en getStats', {
        error: error.message,
        userId
      })
      throw new Error('Error obteniendo estadísticas')
    }
  }

  /**
   * Obtener usuarios activos recientemente
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<User[]>} Array de usuarios activos
   */
  async getRecentActiveUsers(options = {}) {
    try {
      const { limit = 10 } = options

      const userDocs = await UserModel.find({
        isActive: true,
        lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
        .sort({ lastActiveAt: -1 })
        .limit(limit)
        .lean()

      return userDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getRecentActiveUsers', {
        error: error.message,
        options
      })
      throw new Error('Error obteniendo usuarios activos')
    }
  }

  /**
   * Contar usuarios totales
   * @param {Object} criteria - Criterios de conteo
   * @returns {Promise<number>} Número total de usuarios
   */
  async count(criteria = {}) {
    try {
      return await UserModel.countDocuments(criteria)
    } catch (error) {
      logger.error('Error en count', {
        error: error.message,
        criteria
      })
      throw new Error('Error contando usuarios')
    }
  }

  /**
   * Obtener usuarios con más seguidores
   * @param {number} limit - Límite de resultados
   * @returns {Promise<User[]>} Array de usuarios populares
   */
  async getTopUsers(limit = 10) {
    try {
      const userDocs = await UserModel.find({
        isActive: true
      })
        .sort({ followersCount: -1 })
        .limit(limit)
        .lean()

      return userDocs.map(doc => this.toDomain(doc))
    } catch (error) {
      logger.error('Error en getTopUsers', {
        error: error.message,
        limit
      })
      throw new Error('Error obteniendo usuarios populares')
    }
  }

  /**
   * Convertir documento de Mongoose a entidad de dominio
   * @param {Object} doc - Documento de Mongoose
   * @returns {User} Entidad de usuario
   */
  toDomain(doc) {
    return new User({
      id: doc._id.toString(),
      username: doc.username,
      email: doc.email,
      fullName: doc.fullName,
      bio: doc.bio,
      avatar: doc.avatar,
      isVerified: doc.isVerified,
      isActive: doc.isActive,
      role: doc.role,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      followersCount: doc.followersCount,
      followingCount: doc.followingCount,
      postsCount: doc.postsCount,
      privacySettings: doc.privacySettings,
      notificationSettings: doc.notificationSettings,
      blockedUsers: doc.blockedUsers,
      blockedBy: doc.blockedBy,
      preferences: doc.preferences,
      lastActiveAt: doc.lastActiveAt
    })
  }

  /**
   * Convertir entidad de dominio a documento de persistencia
   * @param {User} user - Entidad de usuario
   * @returns {Object} Documento para persistencia
   */
  toPersistence(user) {
    return {
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      bio: user.bio,
      avatar: user.avatar,
      isVerified: user.isVerified,
      isActive: user.isActive,
      role: user.role,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      postsCount: user.postsCount,
      privacySettings: user.privacySettings,
      notificationSettings: user.notificationSettings,
      blockedUsers: user.blockedUsers,
      blockedBy: user.blockedBy,
      preferences: user.preferences,
      lastActiveAt: user.lastActiveAt
    }
  }
}
