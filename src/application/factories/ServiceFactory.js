/**
 * ServiceFactory - Application Layer
 * Factory para crear servicios con inyección de dependencias
 * Implementa el patrón Factory para la creación de servicios
 */

import { UserRepository } from '../../domain/repositories/UserRepository.js'
import { PostRepository } from '../../domain/repositories/PostRepository.js'
import { MongooseUserRepository } from '../../infrastructure/database/repositories/MongooseUserRepository.js'
import { MongoosePostRepository } from '../../infrastructure/database/repositories/MongoosePostRepository.js'
import { CreateUserUseCase } from '../use-cases/user/CreateUserUseCase.js'
import { GetUserProfileUseCase } from '../use-cases/user/GetUserProfileUseCase.js'
import { CreatePostUseCase } from '../use-cases/post/CreatePostUseCase.js'
import cacheService from '../../services/cacheService.js'
import notificationService from '../../services/notificationService.js'
import emailService from '../../services/emailService.js'
import analyticsService from '../../services/analyticsService.js'
import logger from '../../utils/logger.js'

export class ServiceFactory {
  static instances = new Map()

  /**
   * Obtener instancia singleton de un servicio
   * @param {string} serviceName - Nombre del servicio
   * @param {Function} factoryFn - Función factory
   * @returns {any} Instancia del servicio
   */
  static getInstance(serviceName, factoryFn) {
    if (!this.instances.has(serviceName)) {
      this.instances.set(serviceName, factoryFn())
    }
    return this.instances.get(serviceName)
  }

  /**
   * Crear repositorio de usuarios
   * @returns {UserRepository} Repositorio de usuarios
   */
  static createUserRepository() {
    return this.getInstance('userRepository', () => {
      logger.info('Creando instancia de UserRepository')
      return new MongooseUserRepository()
    })
  }

  /**
   * Crear repositorio de posts
   * @returns {PostRepository} Repositorio de posts
   */
  static createPostRepository() {
    return this.getInstance('postRepository', () => {
      logger.info('Creando instancia de PostRepository')
      return new MongoosePostRepository()
    })
  }

  /**
   * Crear caso de uso de crear usuario
   * @returns {CreateUserUseCase} Caso de uso
   */
  static createCreateUserUseCase() {
    return this.getInstance('createUserUseCase', () => {
      logger.info('Creando instancia de CreateUserUseCase')

      const userRepository = this.createUserRepository()
      const authService = this.createAuthService()
      const emailService = this.createEmailService()
      const cacheService = this.createCacheService()

      return new CreateUserUseCase(
        userRepository,
        authService,
        emailService,
        cacheService
      )
    })
  }

  /**
   * Crear caso de uso de obtener perfil de usuario
   * @returns {GetUserProfileUseCase} Caso de uso
   */
  static createGetUserProfileUseCase() {
    return this.getInstance('getUserProfileUseCase', () => {
      logger.info('Creando instancia de GetUserProfileUseCase')

      const userRepository = this.createUserRepository()
      const cacheService = this.createCacheService()
      const analyticsService = this.createAnalyticsService()

      return new GetUserProfileUseCase(
        userRepository,
        cacheService,
        analyticsService
      )
    })
  }

  /**
   * Crear caso de uso de crear post
   * @returns {CreatePostUseCase} Caso de uso
   */
  static createCreatePostUseCase() {
    return this.getInstance('createPostUseCase', () => {
      logger.info('Creando instancia de CreatePostUseCase')

      const postRepository = this.createPostRepository()
      const userRepository = this.createUserRepository()
      const notificationService = this.createNotificationService()
      const cacheService = this.createCacheService()
      const analyticsService = this.createAnalyticsService()
      const mediaService = this.createMediaService()

      return new CreatePostUseCase(
        postRepository,
        userRepository,
        notificationService,
        cacheService,
        analyticsService,
        mediaService
      )
    })
  }

  /**
   * Crear servicio de autenticación
   * @returns {Object} Servicio de autenticación
   */
  static createAuthService() {
    return this.getInstance('authService', () => {
      logger.info('Creando instancia de AuthService')

      // Aquí implementarías el servicio de autenticación
      return {
        generateTokens: async (userId) => {
          // Implementación de generación de tokens
          return {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresIn: 900
          }
        }
      }
    })
  }

  /**
   * Crear servicio de email
   * @returns {Object} Servicio de email
   */
  static createEmailService() {
    return this.getInstance('emailService', () => {
      logger.info('Creando instancia de EmailService')
      return emailService
    })
  }

  /**
   * Crear servicio de cache
   * @returns {Object} Servicio de cache
   */
  static createCacheService() {
    return this.getInstance('cacheService', () => {
      logger.info('Creando instancia de CacheService')
      return cacheService
    })
  }

  /**
   * Crear servicio de notificaciones
   * @returns {Object} Servicio de notificaciones
   */
  static createNotificationService() {
    return this.getInstance('notificationService', () => {
      logger.info('Creando instancia de NotificationService')
      return notificationService
    })
  }

  /**
   * Crear servicio de analytics
   * @returns {Object} Servicio de analytics
   */
  static createAnalyticsService() {
    return this.getInstance('analyticsService', () => {
      logger.info('Creando instancia de AnalyticsService')
      return analyticsService
    })
  }

  /**
   * Crear servicio de media
   * @returns {Object} Servicio de media
   */
  static createMediaService() {
    return this.getInstance('mediaService', () => {
      logger.info('Creando instancia de MediaService')

      return {
        processMedia: async (file, options) => {
          // Implementación de procesamiento de media
          return {
            id: 'mock-media-id',
            url: 'mock-media-url',
            type: file.mimetype.startsWith('image/') ? 'image' : 'video',
            size: file.size,
            duration: null,
            thumbnail: null
          }
        }
      }
    })
  }

  /**
   * Crear controlador de usuarios
   * @returns {Object} Controlador de usuarios
   */
  static createUserController() {
    return this.getInstance('userController', () => {
      logger.info('Creando instancia de UserController')

      const createUserUseCase = this.createCreateUserUseCase()
      const getUserProfileUseCase = this.createGetUserProfileUseCase()

      return {
        createUser: async (req, res) => {
          try {
            const result = await createUserUseCase.execute(req.body)
            res.status(201).json({
              success: true,
              data: result,
              message: 'Usuario creado exitosamente'
            })
          } catch (error) {
            logger.error('Error en createUser controller:', error)
            res.status(400).json({
              success: false,
              message: error.message
            })
          }
        },

        getUserProfile: async (req, res) => {
          try {
            const userId = req.user?.id
            const targetUserId = req.params.id

            const profile = await getUserProfileUseCase.execute(userId, targetUserId)
            res.json({
              success: true,
              data: profile
            })
          } catch (error) {
            logger.error('Error en getUserProfile controller:', error)
            res.status(400).json({
              success: false,
              message: error.message
            })
          }
        }
      }
    })
  }

  /**
   * Crear controlador de posts
   * @returns {Object} Controlador de posts
   */
  static createPostController() {
    return this.getInstance('postController', () => {
      logger.info('Creando instancia de PostController')

      const createPostUseCase = this.createCreatePostUseCase()

      return {
        createPost: async (req, res) => {
          try {
            const userId = req.user?.id
            const postData = req.body

            const post = await createPostUseCase.execute(userId, postData)
            res.status(201).json({
              success: true,
              data: post,
              message: 'Post creado exitosamente'
            })
          } catch (error) {
            logger.error('Error en createPost controller:', error)
            res.status(400).json({
              success: false,
              message: error.message
            })
          }
        }
      }
    })
  }

  /**
   * Limpiar todas las instancias (útil para testing)
   */
  static clearInstances() {
    this.instances.clear()
    logger.info('Instancias de servicios limpiadas')
  }

  /**
   * Obtener estadísticas de instancias creadas
   * @returns {Object} Estadísticas
   */
  static getInstancesStats() {
    return {
      totalInstances: this.instances.size,
      instances: Array.from(this.instances.keys())
    }
  }
}
