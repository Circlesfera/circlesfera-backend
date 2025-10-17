/**
 * Refactored Post Controller - Backend
 * Ejemplo de cómo refactorizar un controlador usando BaseController y Clean Architecture
 * Elimina duplicación y mejora la consistencia
 */

import BaseController from './BaseController.js'
import { CreatePostUseCase } from '../application/use-cases/post/CreatePostUseCase.js'
import { GetUserProfileUseCase } from '../application/use-cases/user/GetUserProfileUseCase.js'
import { ServiceFactory } from '../application/factories/ServiceFactory.js'
import { validateObjectId, handleValidation, validatePagination } from '../middlewares/validationHandler.js'
import logger from '../utils/logger.js'

// Instanciar casos de uso
const createPostUseCase = new CreatePostUseCase(
  ServiceFactory.createPostRepository(),
  ServiceFactory.createUserRepository(),
  ServiceFactory.createNotificationService()
)

const getUserProfileUseCase = new GetUserProfileUseCase(
  ServiceFactory.createUserRepository()
)

/**
 * Crear una nueva publicación
 * Ejemplo de refactorización usando BaseController y Clean Architecture
 */
export const createPost = BaseController.asyncHandler(async (req, res) => {
  // Validación automática usando middleware
  if (!BaseController.handleValidation(req, res)) {
    return
  }

  // Validar autenticación
  if (!BaseController.validateAuth(req, res)) {
    return
  }

  try {
    const postData = {
      user: req.user.id,
      type: req.body.type || 'text',
      caption: req.body.caption || '',
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      location: req.body.location ? { name: req.body.location } : null,
      content: req.body.content || {},
      files: req.files
    }

    // Usar caso de uso en lugar de lógica directa
    const post = await createPostUseCase.execute(postData)

    // Respuesta consistente usando BaseController
    BaseController.sendSuccess(
      res,
      post,
      'Publicación creada exitosamente',
      201
    )

  } catch (error) {
    BaseController.handleError(error, res, 'createPost', {
      userId: req.user.id,
      postType: req.body.type
    })
  }
}, 'createPost')

/**
 * Obtener feed de publicaciones
 * Ejemplo de refactorización con paginación consistente
 */
export const getFeed = BaseController.asyncHandler(async (req, res) => {
  // Validar autenticación
  if (!BaseController.validateAuth(req, res)) {
    return
  }

  try {
    const { page, limit, skip } = req.pagination // Viene del middleware de paginación

    // Usar servicio de feed optimizado
    const feedService = ServiceFactory.createFeedService()
    const { posts, total } = await feedService.getFeed(req.user.id, {
      page,
      limit,
      skip
    })

    // Respuesta paginada consistente
    BaseController.sendPaginatedResponse(posts, { page, limit }, total, res)

  } catch (error) {
    BaseController.handleError(error, res, 'getFeed', {
      userId: req.user.id
    })
  }
}, 'getFeed')

/**
 * Obtener perfil de usuario
 * Ejemplo usando caso de uso específico
 */
export const getUserProfile = BaseController.asyncHandler(async (req, res) => {
  const { username } = req.params

  try {
    const profile = await getUserProfileUseCase.execute(username, req.user?.id)

    // Sanitizar datos del usuario
    const sanitizedProfile = BaseController.sanitizeUser(profile)

    BaseController.sendSuccess(res, sanitizedProfile, 'Perfil obtenido exitosamente')

  } catch (error) {
    BaseController.handleError(error, res, 'getUserProfile', {
      username,
      requestedBy: req.user?.id
    })
  }
}, 'getUserProfile')

/**
 * Dar like a una publicación
 * Ejemplo de operación simple con validaciones
 */
export const likePost = BaseController.asyncHandler(async (req, res) => {
  const { postId } = req.params

  // Validar ObjectId
  if (!BaseController.validateObjectId(postId, res, 'ID de publicación')) {
    return
  }

  // Validar autenticación
  if (!BaseController.validateAuth(req, res)) {
    return
  }

  try {
    const likeService = ServiceFactory.createLikeService()
    const result = await likeService.toggleLike(postId, req.user.id)

    BaseController.sendSuccess(res, result, 'Like actualizado exitosamente')

  } catch (error) {
    BaseController.handleError(error, res, 'likePost', {
      postId,
      userId: req.user.id
    })
  }
}, 'likePost')

/**
 * Eliminar publicación
 * Ejemplo con validación de propiedad
 */
export const deletePost = BaseController.asyncHandler(async (req, res) => {
  const { postId } = req.params

  // Validar ObjectId
  if (!BaseController.validateObjectId(postId, res, 'ID de publicación')) {
    return
  }

  // Validar autenticación
  if (!BaseController.validateAuth(req, res)) {
    return
  }

  try {
    // Obtener publicación para validar propiedad
    const postRepository = ServiceFactory.createPostRepository()
    const post = await postRepository.findById(postId)

    // Validar propiedad usando BaseController
    if (!BaseController.validateOwnership(post, req.user.id, res, 'Publicación')) {
      return
    }

    // Eliminar publicación
    await postRepository.delete(postId)

    BaseController.sendSuccess(res, null, 'Publicación eliminada exitosamente')

  } catch (error) {
    BaseController.handleError(error, res, 'deletePost', {
      postId,
      userId: req.user.id
    })
  }
}, 'deletePost')

/**
 * Obtener publicaciones de un usuario
 * Ejemplo con paginación y validaciones
 */
export const getUserPosts = BaseController.asyncHandler(async (req, res) => {
  const { username } = req.params
  const { page, limit, skip } = req.pagination

  try {
    // Obtener usuario por username
    const user = await getUserProfileUseCase.execute(username)

    if (!user) {
      return BaseController.sendError(res, 'Usuario no encontrado', 404, 'USER_NOT_FOUND')
    }

    // Obtener publicaciones del usuario
    const postRepository = ServiceFactory.createPostRepository()
    const { posts, total } = await postRepository.findByUser(user.id, {
      page,
      limit,
      skip,
      includePrivate: user.id === req.user?.id // Solo mostrar privadas si es el propio usuario
    })

    BaseController.sendPaginatedResponse(posts, { page, limit }, total, res)

  } catch (error) {
    BaseController.handleError(error, res, 'getUserPosts', {
      username,
      requestedBy: req.user?.id
    })
  }
}, 'getUserPosts')

export default {
  createPost,
  getFeed,
  getUserProfile,
  likePost,
  deletePost,
  getUserPosts
}
