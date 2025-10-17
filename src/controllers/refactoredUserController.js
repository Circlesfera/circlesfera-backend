/**
 * 👤 REFACTORED USER CONTROLLER
 * =============================
 * Controlador de usuarios refactorizado usando BaseController
 * Elimina duplicación de código y sigue Clean Architecture
 */

import BaseController from './BaseController.js'
import User from '../models/User.js'
import Post from '../models/Post.js'
import Story from '../models/Story.js'
import Notification from '../models/Notification.js'
import cacheService from '../services/cacheService.js'
import logger from '../utils/logger.js'
import validationHandler from '../middlewares/validationHandler.js'
import { body } from 'express-validator'

class UserController extends BaseController {
  constructor() {
    super()
  }

  // Validaciones específicas para actualizar perfil
  static updateProfileValidations = [
    body('fullName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre completo debe tener entre 2 y 50 caracteres')
      .trim(),
    body('bio')
      .optional()
      .isLength({ max: 150 })
      .withMessage('La biografía no puede exceder los 150 caracteres')
      .trim(),
    body('website')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Debe proporcionar una URL válida'),
    body('location')
      .optional()
      .isLength({ max: 50 })
      .withMessage('La ubicación no puede exceder los 50 caracteres')
      .trim(),
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Debe proporcionar un número de teléfono válido'),
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
      .withMessage('Género inválido'),
    body('birthDate')
      .optional()
      .isISO8601()
      .withMessage('Debe proporcionar una fecha de nacimiento válida')
  ]

  // Validaciones para seguir/dejar de seguir
  static followValidations = [
    body('action')
      .isIn(['follow', 'unfollow'])
      .withMessage('Acción debe ser follow o unfollow')
  ]

  // Validaciones para buscar usuarios
  static searchValidations = [
    body('query')
      .isLength({ min: 1, max: 50 })
      .withMessage('La búsqueda debe tener entre 1 y 50 caracteres')
      .trim()
  ]

  /**
   * Obtener perfil de usuario público
   */
  async getUserProfile(req, res) {
    try {
      const { username } = req.params
      const currentUserId = req.userId

      // Verificar si es el propio perfil
      const isOwnProfile = currentUserId && req.user?.username?.toLowerCase() === username.toLowerCase()

      // Intentar obtener del cache solo para otros usuarios
      if (!isOwnProfile) {
        const cachedProfile = await cacheService.getUserProfile(username)
        if (cachedProfile) {
          // Actualizar isFollowing si hay usuario autenticado
          if (currentUserId && currentUserId !== cachedProfile._id.toString()) {
            const followCheck = await User.findById(currentUserId).select('following').lean()
            if (followCheck) {
              cachedProfile.isFollowing = followCheck.following.some(
                followingId => followingId.toString() === cachedProfile._id.toString()
              )
            }
          }

          return UserController.success(res, { user: cachedProfile }, 'Perfil obtenido del cache')
        }
      }

      // Consultar base de datos
      const user = await User.findOne({ username: username.toLowerCase() })
        .populate('followers', 'username fullName avatar')
        .populate('following', 'username fullName avatar')

      if (!user) {
        return UserController.error(res, 'Usuario no encontrado', 404)
      }

      // Verificar si el usuario actual sigue a este usuario
      let isFollowing = false
      if (currentUserId && currentUserId !== user._id.toString()) {
        const followCheck = await User.findById(currentUserId).select('following').lean()
        if (followCheck) {
          isFollowing = followCheck.following.some(
            followingId => followingId.toString() === user._id.toString()
          )
        }
      }

      // Obtener estadísticas
      const [postsCount, storiesCount] = await Promise.all([
        Post.countDocuments({ user: user._id, isArchived: false, isDeleted: false }),
        Story.countDocuments({ user: user._id, expiresAt: { $gt: new Date() } })
      ])

      const userProfile = {
        ...this.sanitizeUser(user),
        followersCount: user.followers.length,
        followingCount: user.following.length,
        postsCount,
        storiesCount,
        isFollowing,
        isOwnProfile: isOwnProfile || false
      }

      // Cachear perfil para otros usuarios
      if (!isOwnProfile) {
        await cacheService.setUserProfile(username, userProfile, 300) // 5 minutos
      }

      logger.info('Perfil obtenido exitosamente', { username, isOwnProfile })

      return UserController.success(res, { user: userProfile }, 'Perfil obtenido exitosamente')

    } catch (error) {
      logger.error('Error obteniendo perfil:', error)
      return UserController.handleError(res, error)
    }
  }

  /**
   * Actualizar perfil del usuario
   */
  async updateProfile(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { userId } = req
      const updates = req.body

      // Campos permitidos para actualización
      const allowedFields = ['fullName', 'bio', 'website', 'location', 'phone', 'gender', 'birthDate']
      const filteredUpdates = {}

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field]?.trim() || ''
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        filteredUpdates,
        { new: true, runValidators: true }
      ).populate('followers following', 'username fullName avatar')

      if (!user) {
        return UserController.error(res, 'Usuario no encontrado', 404)
      }

      // Limpiar cache del perfil
      await cacheService.del(`user_profile:${user.username}`)

      logger.info('Perfil actualizado exitosamente', { userId })

      return UserController.success(res, {
        user: this.sanitizeUser(user)
      }, 'Perfil actualizado exitosamente')

    } catch (error) {
      logger.error('Error actualizando perfil:', error)
      return UserController.handleError(res, error)
    }
  }

  /**
   * Seguir/Dejar de seguir usuario
   */
  async toggleFollow(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { userId: targetUserId } = req.params
      const currentUserId = req.userId
      const { action } = req.body

      // Verificar ObjectId
      if (!this.validateObjectId(targetUserId)) {
        return UserController.error(res, 'ID de usuario inválido', 400)
      }

      // No se puede seguir a sí mismo
      if (currentUserId === targetUserId) {
        return UserController.error(res, 'No puedes seguirte a ti mismo', 400)
      }

      // Verificar que el usuario objetivo existe
      const targetUser = await User.findById(targetUserId)
      if (!targetUser) {
        return UserController.error(res, 'Usuario no encontrado', 404)
      }

      const currentUser = await User.findById(currentUserId)
      if (!currentUser) {
        return UserController.error(res, 'Usuario actual no encontrado', 404)
      }

      const isCurrentlyFollowing = currentUser.following.includes(targetUserId)

      if (action === 'follow') {
        if (isCurrentlyFollowing) {
          return UserController.error(res, 'Ya sigues a este usuario', 400)
        }

        // Agregar a following del usuario actual
        currentUser.following.push(targetUserId)
        await currentUser.save()

        // Agregar a followers del usuario objetivo
        targetUser.followers.push(currentUserId)
        await targetUser.save()

        // Crear notificación
        await Notification.create({
          user: targetUserId,
          type: 'follow',
          fromUser: currentUserId,
          message: 'empezó a seguirte'
        })

        logger.info('Usuario seguido exitosamente', { currentUserId, targetUserId })

        return UserController.success(res, {
          isFollowing: true,
          followersCount: targetUser.followers.length
        }, 'Usuario seguido exitosamente')
      }

      if (action === 'unfollow') {
        if (!isCurrentlyFollowing) {
          return UserController.error(res, 'No sigues a este usuario', 400)
        }

        // Remover de following del usuario actual
        currentUser.following.pull(targetUserId)
        await currentUser.save()

        // Remover de followers del usuario objetivo
        targetUser.followers.pull(currentUserId)
        await targetUser.save()

        logger.info('Usuario dejado de seguir exitosamente', { currentUserId, targetUserId })

        return UserController.success(res, {
          isFollowing: false,
          followersCount: targetUser.followers.length
        }, 'Usuario dejado de seguir exitosamente')
      }

    } catch (error) {
      logger.error('Error toggling follow:', error)
      return UserController.handleError(res, error)
    }
  }

  /**
   * Buscar usuarios
   */
  async searchUsers(req, res) {
    try {
      const validationError = this.handleValidation(req, res)
      if (validationError) {
        return validationError
      }

      const { query } = req.body
      const currentUserId = req.userId
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar cache
      const cacheKey = `user_search:${query}:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedResults = await cacheService.get(cacheKey)

      if (cachedResults) {
        return UserController.success(res, JSON.parse(cachedResults), 'Resultados obtenidos del cache')
      }

      // Buscar usuarios
      const users = await User.find({
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { fullName: { $regex: query, $options: 'i' } }
        ],
        _id: { $ne: currentUserId } // Excluir al usuario actual
      })
        .select('username fullName avatar bio followersCount')
        .sort({ followersCount: -1, username: 1 })
        .skip(paginationOptions.skip)
        .limit(paginationOptions.limit)
        .lean()

      // Verificar relaciones de seguimiento
      if (currentUserId) {
        const currentUser = await User.findById(currentUserId).select('following').lean()
        if (currentUser) {
          users.forEach(user => {
            user.isFollowing = currentUser.following.some(
              followingId => followingId.toString() === user._id.toString()
            )
          })
        }
      }

      const total = await User.countDocuments({
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { fullName: { $regex: query, $options: 'i' } }
        ],
        _id: { $ne: currentUserId }
      })

      const response = this.createPaginatedResponse(users, paginationOptions, total)

      // Cachear resultados
      await cacheService.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      logger.info('Búsqueda de usuarios completada', { query, resultsCount: users.length })

      return UserController.success(res, response, 'Búsqueda completada exitosamente')

    } catch (error) {
      logger.error('Error buscando usuarios:', error)
      return UserController.handleError(res, error)
    }
  }

  /**
   * Obtener seguidores de un usuario
   */
  async getFollowers(req, res) {
    try {
      const { userId } = req.params
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar ObjectId
      if (!this.validateObjectId(userId)) {
        return UserController.error(res, 'ID de usuario inválido', 400)
      }

      // Verificar cache
      const cacheKey = `user_followers:${userId}:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedResults = await cacheService.get(cacheKey)

      if (cachedResults) {
        return UserController.success(res, JSON.parse(cachedResults), 'Seguidores obtenidos del cache')
      }

      const user = await User.findById(userId)
        .populate({
          path: 'followers',
          select: 'username fullName avatar bio',
          options: {
            skip: paginationOptions.skip,
            limit: paginationOptions.limit,
            sort: { createdAt: -1 }
          }
        })

      if (!user) {
        return UserController.error(res, 'Usuario no encontrado', 404)
      }

      const total = user.followers.length
      const response = this.createPaginatedResponse(user.followers, paginationOptions, total)

      // Cachear resultados
      await cacheService.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      return UserController.success(res, response, 'Seguidores obtenidos exitosamente')

    } catch (error) {
      logger.error('Error obteniendo seguidores:', error)
      return UserController.handleError(res, error)
    }
  }

  /**
   * Obtener usuarios seguidos
   */
  async getFollowing(req, res) {
    try {
      const { userId } = req.params
      const paginationOptions = this.getPaginationOptions(req)

      // Verificar ObjectId
      if (!this.validateObjectId(userId)) {
        return UserController.error(res, 'ID de usuario inválido', 400)
      }

      // Verificar cache
      const cacheKey = `user_following:${userId}:${paginationOptions.page}:${paginationOptions.limit}`
      const cachedResults = await cacheService.get(cacheKey)

      if (cachedResults) {
        return UserController.success(res, JSON.parse(cachedResults), 'Seguidos obtenidos del cache')
      }

      const user = await User.findById(userId)
        .populate({
          path: 'following',
          select: 'username fullName avatar bio',
          options: {
            skip: paginationOptions.skip,
            limit: paginationOptions.limit,
            sort: { createdAt: -1 }
          }
        })

      if (!user) {
        return UserController.error(res, 'Usuario no encontrado', 404)
      }

      const total = user.following.length
      const response = this.createPaginatedResponse(user.following, paginationOptions, total)

      // Cachear resultados
      await cacheService.set(cacheKey, JSON.stringify(response), 300) // 5 minutos

      return UserController.success(res, response, 'Usuarios seguidos obtenidos exitosamente')

    } catch (error) {
      logger.error('Error obteniendo seguidos:', error)
      return UserController.handleError(res, error)
    }
  }

  /**
   * Eliminar cuenta de usuario
   */
  async deleteAccount(req, res) {
    try {
      const { userId } = req
      const { password } = req.body

      if (!password) {
        return UserController.error(res, 'La contraseña es requerida para eliminar la cuenta', 400)
      }

      // Verificar contraseña
      const user = await User.findById(userId).select('+password')
      if (!user) {
        return UserController.error(res, 'Usuario no encontrado', 404)
      }

      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        return UserController.error(res, 'Contraseña incorrecta', 400)
      }

      // Soft delete del usuario
      await User.findByIdAndUpdate(userId, {
        isDeleted: true,
        deletedAt: new Date(),
        username: `deleted_${userId}`,
        email: `deleted_${userId}@deleted.com`
      })

      // Eliminar relaciones de seguimiento
      await User.updateMany(
        { following: userId },
        { $pull: { following: userId } }
      )

      await User.updateMany(
        { followers: userId },
        { $pull: { followers: userId } }
      )

      // Soft delete de posts y stories
      await Post.updateMany({ user: userId }, { isDeleted: true, deletedAt: new Date() })
      await Story.updateMany({ user: userId }, { isDeleted: true, deletedAt: new Date() })

      // Limpiar cache
      await cacheService.del(`user_profile:${user.username}`)
      await cacheService.del(`refresh_token:${userId}`)

      logger.info('Cuenta eliminada exitosamente', { userId })

      return UserController.success(res, null, 'Cuenta eliminada exitosamente')

    } catch (error) {
      logger.error('Error eliminando cuenta:', error)
      return UserController.handleError(res, error)
    }
  }
}

export const userController = new UserController()

// Exportar las validaciones para uso en rutas
export {
  UserController
}
