/**
 * Middleware de Validación de Ownership (Propiedad)
 * Verifica que el usuario autenticado sea el dueño del recurso antes de permitir operaciones
 */

import Post from '../models/Post.js'
import Reel from '../models/Reel.js'
import Story from '../models/Story.js'
import Comment from '../models/Comment.js'
import Message from '../models/Message.js'
import Conversation from '../models/Conversation.js'
import LiveStream from '../models/LiveStream.js'
import CSTV from '../models/CSTV.js'
import logger from '../utils/logger.js'

/**
 * Mapeo de modelos por tipo de recurso
 */
const RESOURCE_MODELS = {
  post: Post,
  reel: Reel,
  story: Story,
  comment: Comment,
  message: Message,
  conversation: Conversation,
  liveStream: LiveStream,
  cstv: CSTV
}

/**
 * Verificar ownership genérico
 * @param {string} resourceType - Tipo de recurso ('post', 'reel', etc.)
 * @param {string} idParam - Nombre del parámetro de ID en req.params (default: 'id')
 * @returns {Function} Middleware
 */
export function checkOwnership(resourceType, idParam = 'id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam]
      const userId = req.user?._id || req.userId

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        })
      }

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'ID del recurso no proporcionado'
        })
      }

      const Model = RESOURCE_MODELS[resourceType]

      if (!Model) {
        logger.error(`Modelo no encontrado para tipo de recurso: ${resourceType}`)
        return res.status(500).json({
          success: false,
          message: 'Error de configuración del servidor'
        })
      }

      // Buscar el recurso
      const resource = await Model.findById(resourceId)

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: `${capitalizeFirst(resourceType)} no encontrado`
        })
      }

      // Verificar ownership
      const resourceUserId = resource.user?._id || resource.user

      if (!resourceUserId) {
        logger.error(`Recurso ${resourceType} ${resourceId} no tiene campo 'user'`)
        return res.status(500).json({
          success: false,
          message: 'Error al verificar permisos'
        })
      }

      // Comparar IDs (convertir a string para comparación)
      if (resourceUserId.toString() !== userId.toString()) {
        logger.warn(`Intento de acceso no autorizado por usuario ${userId} a ${resourceType} ${resourceId}`, {
          userId,
          resourceType,
          resourceId,
          resourceOwner: resourceUserId
        })

        return res.status(403).json({
          success: false,
          message: `No tienes permisos para modificar este ${resourceType}`
        })
      }

      // Ownership verificado, adjuntar recurso al request para evitar segunda consulta
      req.resource = resource

      next()
    } catch (error) {
      logger.error(`Error en checkOwnership (${resourceType}):`, error)

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'ID inválido proporcionado'
        })
      }

      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos'
      })
    }
  }
}

/**
 * Verificar ownership para posts
 * Alias conveniente para checkOwnership('post')
 */
export const checkPostOwnership = () => checkOwnership('post')

/**
 * Verificar ownership para reels
 * Alias conveniente para checkOwnership('reel')
 */
export const checkReelOwnership = () => checkOwnership('reel')

/**
 * Verificar ownership para stories
 * Alias conveniente para checkOwnership('story')
 */
export const checkStoryOwnership = () => checkOwnership('story')

/**
 * Verificar ownership para comentarios
 * Alias conveniente para checkOwnership('comment')
 */
export const checkCommentOwnership = () => checkOwnership('comment')

/**
 * Verificar ownership para mensajes
 * Alias conveniente para checkOwnership('message')
 */
export const checkMessageOwnership = () => checkOwnership('message')

/**
 * Verificar ownership para conversaciones
 * Verifica que el usuario sea participante de la conversación
 */
export function checkConversationParticipant(idParam = 'id') {
  return async (req, res, next) => {
    try {
      const conversationId = req.params[idParam]
      const userId = req.user?._id || req.userId

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        })
      }

      const conversation = await Conversation.findById(conversationId)

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        })
      }

      // Verificar que el usuario sea participante
      const isParticipant = conversation.participants.some(
        p => p.toString() === userId.toString()
      )

      if (!isParticipant) {
        logger.warn(`Intento de acceso no autorizado por usuario ${userId} a conversación ${conversationId}`)

        return res.status(403).json({
          success: false,
          message: 'No eres participante de esta conversación'
        })
      }

      req.resource = conversation
      next()
    } catch (error) {
      logger.error('Error en checkConversationParticipant:', error)
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos'
      })
    }
  }
}

/**
 * Verificar ownership O permisos de moderador/admin
 * @param {string} resourceType - Tipo de recurso
 * @param {string} idParam - Nombre del parámetro de ID
 * @returns {Function} Middleware
 */
export function checkOwnershipOrAdmin(resourceType, idParam = 'id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam]
      const userId = req.user?._id || req.userId
      const userRole = req.user?.role || 'user'

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        })
      }

      // Si es admin/moderador, permitir sin verificar ownership
      if (userRole === 'admin' || userRole === 'moderator') {
        return next()
      }

      // Si no es admin, verificar ownership normalmente
      return checkOwnership(resourceType, idParam)(req, res, next)
    } catch (error) {
      logger.error(`Error en checkOwnershipOrAdmin (${resourceType}):`, error)
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos'
      })
    }
  }
}

/**
 * Capitalizar primera letra (helper)
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default checkOwnership

