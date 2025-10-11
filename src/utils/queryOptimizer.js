/**
 * Utilidades para optimizar queries de MongoDB
 */

/**
 * Campos básicos de usuario para populate
 */
const USER_BASIC_FIELDS = 'username avatar fullName isVerified'

/**
 * Campos de usuario para populate en feed
 */
const USER_FEED_FIELDS = 'username avatar fullName isVerified bio'

/**
 * Campos de usuario para populate en perfil
 */
const USER_PROFILE_FIELDS =
  'username avatar fullName isVerified bio website location followers following'

/**
 * Opciones de paginación estándar
 * @param {number} page - Página actual
 * @param {number} limit - Elementos por página
 * @returns {Object} Objeto con skip y limit
 */
const getPaginationOptions = (page = 1, limit = 10) => {
  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)

  const skip = (pageNum - 1) * limitNum

  return {
    skip,
    limit: limitNum,
    page: pageNum
  }
}

/**
 * Crear objeto de respuesta paginada
 * @param {Array} data - Datos a retornar
 * @param {number} total - Total de documentos
 * @param {number} page - Página actual
 * @param {number} limit - Elementos por página
 * @returns {Object} Respuesta con paginación
 */
const createPaginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit)

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: totalPages,
      hasMore: page < totalPages
    }
  }
}

/**
 * Opciones de populate optimizado para posts
 */
const getPostPopulateOptions = () => [
  {
    path: 'user',
    select: USER_BASIC_FIELDS
  }
]

/**
 * Opciones de populate optimizado para comentarios
 */
const getCommentPopulateOptions = () => [
  {
    path: 'user',
    select: USER_BASIC_FIELDS
  },
  {
    path: 'parentComment',
    select: 'content user createdAt',
    populate: {
      path: 'user',
      select: 'username avatar'
    }
  }
]

/**
 * Opciones de populate optimizado para mensajes
 */
const getMessagePopulateOptions = () => [
  {
    path: 'sender',
    select: USER_BASIC_FIELDS
  },
  {
    path: 'replyTo',
    select: 'content sender createdAt',
    populate: {
      path: 'sender',
      select: 'username avatar'
    }
  }
]

/**
 * Opciones de populate optimizado para notificaciones
 */
const getNotificationPopulateOptions = () => [
  {
    path: 'from',
    select: USER_BASIC_FIELDS
  },
  {
    path: 'post',
    select: 'content caption'
  },
  {
    path: 'comment',
    select: 'content'
  }
]

/**
 * Opciones de populate optimizado para stories
 */
const getStoryPopulateOptions = () => [
  {
    path: 'user',
    select: USER_BASIC_FIELDS
  }
]

/**
 * Opciones de populate optimizado para reels
 */
const getReelPopulateOptions = () => [
  {
    path: 'user',
    select: USER_BASIC_FIELDS
  }
]

/**
 * Generar clave de caché para consultas
 * @param {string} model - Nombre del modelo
 * @param {Object} query - Query de MongoDB
 * @param {Object} options - Opciones adicionales
 * @returns {string} Clave única para caché
 */
const generateCacheKey = (model, query = {}, options = {}) => {
  const queryStr = JSON.stringify(query)
  const optionsStr = JSON.stringify(options)
  return `${model}:${queryStr}:${optionsStr}`
}

export {
  USER_BASIC_FIELDS,
  USER_FEED_FIELDS,
  USER_PROFILE_FIELDS,
  getPaginationOptions,
  createPaginatedResponse,
  getPostPopulateOptions,
  getCommentPopulateOptions,
  getMessagePopulateOptions,
  getNotificationPopulateOptions,
  getStoryPopulateOptions,
  getReelPopulateOptions,
  generateCacheKey
}
