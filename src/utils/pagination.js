/**
 * Utilidades para manejo de paginación en la API
 */

/**
 * Parsear y validar parámetros de paginación
 * @param {Object} query - Query params de la petición
 * @param {Object} options - Opciones por defecto
 * @returns {Object} Parámetros de paginación validados
 */
export const parsePaginationParams = (query, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100
  } = options

  let page = parseInt(query.page) || defaultPage
  let limit = parseInt(query.limit) || defaultLimit

  // Validar valores
  if (page < 1) { page = 1 }
  if (limit < 1) { limit = defaultLimit }
  if (limit > maxLimit) { limit = maxLimit }

  const skip = (page - 1) * limit

  return {
    page,
    limit,
    skip
  }
}

/**
 * Helper para parsear un string de sort a objeto
 * @param {string} sortString - String de ordenamiento
 * @returns {Object} Objeto de ordenamiento
 */
const parseSort = (sortString) => {
  const sortObj = {}
  const isDesc = sortString.startsWith('-')
  const field = isDesc ? sortString.substring(1) : sortString
  sortObj[field] = isDesc ? -1 : 1
  return sortObj
}

/**
 * Parsear parámetros de ordenamiento
 * @param {string} sortQuery - Query string de ordenamiento (ej: "-createdAt,likes")
 * @param {string} defaultSort - Ordenamiento por defecto
 * @param {Array} allowedFields - Campos permitidos para ordenar
 * @returns {Object} Objeto de ordenamiento para Mongoose
 */
export const parseSortParams = (sortQuery, defaultSort = '-createdAt', allowedFields = []) => {
  if (!sortQuery) {
    return parseSort(defaultSort)
  }

  const sortFields = sortQuery.split(',')
  const sortObj = {}

  sortFields.forEach(field => {
    let actualField = field
    let order = 1

    // Si empieza con "-" es descendente
    if (field.startsWith('-')) {
      actualField = field.substring(1)
      order = -1
    }

    // Si hay campos permitidos, validar
    if (allowedFields.length > 0 && !allowedFields.includes(actualField)) {
      return // Ignorar campos no permitidos
    }

    sortObj[actualField] = order
  })

  // Si no hay campos válidos, usar el default
  if (Object.keys(sortObj).length === 0) {
    return parseSort(defaultSort)
  }

  return sortObj
}

/**
 * Crear objeto de paginación para la respuesta
 * @param {number} page - Página actual
 * @param {number} limit - Límite de resultados
 * @param {number} total - Total de documentos
 * @returns {Object} Objeto de paginación
 */
export const createPaginationObject = (page, limit, total) => {
  const pages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1
  }
}

/**
 * Aplicar paginación a un query de Mongoose
 * @param {Object} query - Query de Mongoose
 * @param {Object} params - Parámetros de paginación
 * @returns {Object} Query con paginación aplicada
 */
export const applyPagination = (query, params) => query
  .limit(params.limit)
  .skip(params.skip)

/**
 * Aplicar ordenamiento a un query de Mongoose
 * @param {Object} query - Query de Mongoose
 * @param {Object} sortObj - Objeto de ordenamiento
 * @returns {Object} Query con ordenamiento aplicado
 */
export const applySort = (query, sortObj) => query.sort(sortObj)

