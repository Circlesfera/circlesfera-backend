import logger from '../../utils/logger.js'

/**
 * Optimizador de respuestas para mejorar performance de la API
 * Implementa compresión, paginación inteligente y optimización de datos
 */
class ResponseOptimizer {
  constructor() {
    this.compressionThreshold = 1024 // 1KB
    this.maxResponseSize = 1024 * 1024 // 1MB
    this.defaultPageSize = 20
    this.maxPageSize = 100
  }

  /**
   * Optimizar respuesta estándar
   */
  optimizeResponse(data, options = {}) {
    const {
      compress = true,
      paginate = false,
      page = 1,
      limit = this.defaultPageSize,
      fields = null,
      includeMeta = true
    } = options

    let optimizedData = data

    // Aplicar paginación si es necesario
    if (paginate && Array.isArray(data)) {
      optimizedData = this.paginateData(data, page, limit)
    }

    // Filtrar campos si se especifica
    if (fields && Array.isArray(optimizedData)) {
      optimizedData = this.filterFields(optimizedData, fields)
    }

    // Crear respuesta optimizada
    const response = {
      success: true,
      data: optimizedData
    }

    // Agregar metadatos si se solicita
    if (includeMeta) {
      response.meta = this.generateMeta(data, page, limit, options)
    }

    // Comprimir si es necesario
    if (compress && this.shouldCompress(response)) {
      response.compressed = true
      response.originalSize = JSON.stringify(response).length
    }

    return response
  }

  /**
   * Paginar datos
   */
  paginateData(data, page, limit) {
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit

    return {
      items: data.slice(startIndex, endIndex),
      pagination: {
        page,
        limit,
        total: data.length,
        pages: Math.ceil(data.length / limit),
        hasNext: endIndex < data.length,
        hasPrev: page > 1
      }
    }
  }

  /**
   * Filtrar campos específicos
   */
  filterFields(data, fields) {
    if (!Array.isArray(data)) {
      return this.filterObjectFields(data, fields)
    }

    return data.map(item => this.filterObjectFields(item, fields))
  }

  /**
   * Filtrar campos de un objeto
   */
  filterObjectFields(obj, fields) {
    if (!obj || typeof obj !== 'object') { return obj }

    const filtered = {}
    for (const field of fields) {
      if (obj.hasOwnProperty(field)) {
        filtered[field] = obj[field]
      }
    }
    return filtered
  }

  /**
   * Generar metadatos de respuesta
   */
  generateMeta(data, page, limit, options) {
    const meta = {
      timestamp: new Date().toISOString(),
      version: '1.0'
    }

    // Agregar información de paginación si aplica
    if (options.paginate && Array.isArray(data)) {
      meta.pagination = {
        page,
        limit,
        total: data.length,
        pages: Math.ceil(data.length / limit)
      }
    }

    // Agregar información de performance
    meta.performance = {
      processingTime: options.processingTime || 0,
      cacheHit: options.cacheHit || false,
      compressed: options.compressed || false
    }

    return meta
  }

  /**
   * Determinar si la respuesta debe comprimirse
   */
  shouldCompress(response) {
    const size = JSON.stringify(response).length
    return size > this.compressionThreshold
  }

  /**
   * Optimizar respuesta de lista con lazy loading
   */
  optimizeListResponse(items, options = {}) {
    const {
      page = 1,
      limit = this.defaultPageSize,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {}
    } = options

    // Aplicar filtros
    let filteredItems = this.applyFilters(items, filters)

    // Aplicar ordenamiento
    filteredItems = this.applySorting(filteredItems, sortBy, sortOrder)

    // Aplicar paginación
    const paginatedData = this.paginateData(filteredItems, page, limit)

    return {
      success: true,
      data: paginatedData.items,
      pagination: paginatedData.pagination,
      meta: {
        total: filteredItems.length,
        sortBy,
        sortOrder,
        filters: Object.keys(filters),
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Aplicar filtros a los datos
   */
  applyFilters(items, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return items
    }

    return items.filter(item => Object.entries(filters).every(([key, value]) => {
      if (value === null || value === undefined) { return true }

      if (typeof value === 'string') {
        return item[key] && item[key].toString().toLowerCase().includes(value.toLowerCase())
      }

      if (typeof value === 'object' && value.$gte !== undefined) {
        return item[key] >= value.$gte
      }

      if (typeof value === 'object' && value.$lte !== undefined) {
        return item[key] <= value.$lte
      }

      return item[key] === value
    }))
  }

  /**
   * Aplicar ordenamiento
   */
  applySorting(items, sortBy, sortOrder) {
    return items.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]

      if (aVal === bVal) { return 0 }

      const comparison = aVal < bVal ? -1 : 1
      return sortOrder === 'desc' ? -comparison : comparison
    })
  }

  /**
   * Optimizar respuesta de búsqueda
   */
  optimizeSearchResponse(results, query, options = {}) {
    const {
      page = 1,
      limit = this.defaultPageSize,
      highlight = true,
      facets = false
    } = options

    const paginatedResults = this.paginateData(results, page, limit)

    const response = {
      success: true,
      data: paginatedResults.items,
      pagination: paginatedResults.pagination,
      meta: {
        query,
        total: results.length,
        timestamp: new Date().toISOString()
      }
    }

    // Agregar highlights si se solicita
    if (highlight) {
      response.highlights = this.generateHighlights(results, query)
    }

    // Agregar facets si se solicita
    if (facets) {
      response.facets = this.generateFacets(results)
    }

    return response
  }

  /**
   * Generar highlights para búsqueda
   */
  generateHighlights(results, query) {
    const highlights = {}
    const queryTerms = query.toLowerCase().split(' ')

    results.forEach((result, index) => {
      const highlightsForItem = []

      // Buscar términos en campos de texto
      const textFields = ['caption', 'description', 'title', 'content']

      textFields.forEach(field => {
        if (result[field]) {
          const text = result[field].toString().toLowerCase()
          queryTerms.forEach(term => {
            if (text.includes(term)) {
              highlightsForItem.push({
                field,
                term,
                context: this.getTextContext(result[field], term)
              })
            }
          })
        }
      })

      if (highlightsForItem.length > 0) {
        highlights[index] = highlightsForItem
      }
    })

    return highlights
  }

  /**
   * Obtener contexto del texto alrededor de un término
   */
  getTextContext(text, term, contextLength = 50) {
    const index = text.toLowerCase().indexOf(term.toLowerCase())
    if (index === -1) { return text }

    const start = Math.max(0, index - contextLength)
    const end = Math.min(text.length, index + term.length + contextLength)

    let context = text.substring(start, end)
    if (start > 0) { context = `...${context}` }
    if (end < text.length) { context = `${context}...` }

    return context
  }

  /**
   * Generar facets para filtrado
   */
  generateFacets(results) {
    const facets = {}

    // Facets comunes
    const facetFields = ['category', 'tags', 'type', 'status']

    facetFields.forEach(field => {
      const values = {}
      results.forEach(result => {
        if (result[field]) {
          const value = Array.isArray(result[field]) ? result[field] : [result[field]]
          value.forEach(v => {
            values[v] = (values[v] || 0) + 1
          })
        }
      })

      if (Object.keys(values).length > 0) {
        facets[field] = Object.entries(values)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
      }
    })

    return facets
  }

  /**
   * Validar y ajustar límites de paginación
   */
  validatePagination(page, limit) {
    const validPage = Math.max(1, parseInt(page) || 1)
    const validLimit = Math.min(
      this.maxPageSize,
      Math.max(1, parseInt(limit) || this.defaultPageSize)
    )

    return { page: validPage, limit: validLimit }
  }

  /**
   * Obtener estadísticas de respuestas
   */
  getResponseStats() {
    return {
      compressionThreshold: this.compressionThreshold,
      maxResponseSize: this.maxResponseSize,
      defaultPageSize: this.defaultPageSize,
      maxPageSize: this.maxPageSize
    }
  }
}

// Singleton instance
const responseOptimizer = new ResponseOptimizer()

export default responseOptimizer
