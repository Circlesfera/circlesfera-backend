import logger from '../../utils/logger.js'

/**
 * Optimizador de consultas para MongoDB
 * Proporciona métodos para optimizar consultas y mejorar performance
 */
class QueryOptimizer {
  constructor() {
    this.queryCache = new Map()
    this.slowQueryThreshold = 1000 // 1 segundo
    this.queryStats = new Map()
  }

  /**
   * Optimizar consulta de agregación
   */
  optimizeAggregation(pipeline, options = {}) {
    const {
      addIndexHints = true,
      addProjection = true,
      optimizeSort = true,
      addExplain = false
    } = options

    const optimizedPipeline = [...pipeline]

    // Agregar $match al principio si no existe
    if (!optimizedPipeline[0] || !optimizedPipeline[0].$match) {
      optimizedPipeline.unshift({ $match: {} })
    }

    // Optimizar $sort
    if (optimizeSort) {
      optimizedPipeline.forEach((stage, index) => {
        if (stage.$sort) {
          // Mover $sort después de $match y $lookup
          const sortStage = optimizedPipeline.splice(index, 1)[0]
          let insertIndex = 1

          // Buscar el último $lookup o $match
          for (let i = 0; i < optimizedPipeline.length; i++) {
            if (optimizedPipeline[i].$lookup || optimizedPipeline[i].$match) {
              insertIndex = i + 1
            }
          }

          optimizedPipeline.splice(insertIndex, 0, sortStage)
        }
      })
    }

    // Agregar proyección al final para limitar campos
    if (addProjection && !this.hasProjection(optimizedPipeline)) {
      optimizedPipeline.push({
        $project: {
          _id: 1,
          // Campos básicos que siempre necesitamos
          createdAt: 1,
          updatedAt: 1
        }
      })
    }

    // Agregar $limit si no existe
    if (!this.hasLimit(optimizedPipeline)) {
      optimizedPipeline.push({ $limit: 1000 }) // Límite por defecto
    }

    if (addExplain) {
      optimizedPipeline.push({ $explain: true })
    }

    return optimizedPipeline
  }

  /**
   * Optimizar consulta de find
   */
  optimizeFind(query, options = {}) {
    const {
      addSelect = true,
      addSort = true,
      addLimit = true,
      defaultLimit = 20,
      maxLimit = 100
    } = options

    const optimizedQuery = { ...query }

    // Agregar select para limitar campos
    if (addSelect && !optimizedQuery.select) {
      optimizedQuery.select = {
        _id: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }

    // Agregar sort por defecto
    if (addSort && !optimizedQuery.sort) {
      optimizedQuery.sort = { createdAt: -1 }
    }

    // Agregar límite
    if (addLimit && !optimizedQuery.limit) {
      optimizedQuery.limit = Math.min(defaultLimit, maxLimit)
    }

    // Optimizar populate
    if (optimizedQuery.populate) {
      optimizedQuery.populate = this.optimizePopulate(optimizedQuery.populate)
    }

    return optimizedQuery
  }

  /**
   * Optimizar populate para evitar over-population
   */
  optimizePopulate(populate) {
    if (Array.isArray(populate)) {
      return populate.map(pop => {
        if (typeof pop === 'string') {
          return {
            path: pop,
            select: '_id name username avatar'
          }
        }
        return {
          ...pop,
          select: pop.select || '_id name username avatar'
        }
      })
    }

    if (typeof populate === 'string') {
      return {
        path: populate,
        select: '_id name username avatar'
      }
    }

    return {
      ...populate,
      select: populate.select || '_id name username avatar'
    }
  }

  /**
   * Verificar si el pipeline tiene proyección
   */
  hasProjection(pipeline) {
    return pipeline.some(stage => stage.$project)
  }

  /**
   * Verificar si el pipeline tiene límite
   */
  hasLimit(pipeline) {
    return pipeline.some(stage => stage.$limit)
  }

  /**
   * Crear índice compuesto para consultas comunes
   */
  createCompoundIndex(collection, fields) {
    const indexSpec = {}
    fields.forEach(field => {
      if (typeof field === 'string') {
        indexSpec[field] = 1
      } else if (Array.isArray(field)) {
        indexSpec[field[0]] = field[1] || 1
      }
    })

    return {
      collection,
      index: indexSpec,
      options: {
        background: true,
        name: `${collection}_${Object.keys(indexSpec).join('_')}_idx`
      }
    }
  }

  /**
   * Analizar consulta lenta
   */
  analyzeSlowQuery(query, executionTime, collection) {
    const queryId = this.generateQueryId(query)
    const stats = this.queryStats.get(queryId) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      collection,
      query: JSON.stringify(query)
    }

    stats.count++
    stats.totalTime += executionTime
    stats.avgTime = stats.totalTime / stats.count
    stats.maxTime = Math.max(stats.maxTime, executionTime)

    this.queryStats.set(queryId, stats)

    if (executionTime > this.slowQueryThreshold) {
      logger.warn('Slow query detected:', {
        queryId,
        executionTime,
        collection,
        query: JSON.stringify(query),
        stats
      })
    }

    return stats
  }

  /**
   * Generar ID único para consulta
   */
  generateQueryId(query) {
    const queryStr = JSON.stringify(query, Object.keys(query).sort())
    return Buffer.from(queryStr).toString('base64').slice(0, 16)
  }

  /**
   * Obtener estadísticas de consultas
   */
  getQueryStats() {
    const stats = Array.from(this.queryStats.values())
    return {
      totalQueries: stats.length,
      slowQueries: stats.filter(s => s.avgTime > this.slowQueryThreshold).length,
      avgExecutionTime: stats.reduce((sum, s) => sum + s.avgTime, 0) / stats.length,
      queries: stats.sort((a, b) => b.avgTime - a.avgTime).slice(0, 10) // Top 10 más lentas
    }
  }

  /**
   * Sugerir índices basados en consultas frecuentes
   */
  suggestIndexes() {
    const suggestions = []
    const queryCounts = new Map()

    // Analizar patrones en las consultas
    for (const stats of this.queryStats.values()) {
      try {
        const query = JSON.parse(stats.query)

        // Analizar campos de filtro
        const filterFields = this.extractFilterFields(query)
        if (filterFields.length > 0) {
          const key = filterFields.sort().join('|')
          const count = queryCounts.get(key) || 0
          queryCounts.set(key, count + stats.count)
        }
      } catch (_error) {
        // Ignorar errores de parsing
      }
    }

    // Generar sugerencias
    for (const [fields, count] of queryCounts.entries()) {
      if (count > 10) { // Solo sugerir para consultas frecuentes
        const fieldList = fields.split('|')
        suggestions.push({
          fields: fieldList,
          frequency: count,
          priority: count > 100 ? 'high' : count > 50 ? 'medium' : 'low'
        })
      }
    }

    return suggestions.sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Extraer campos de filtro de una consulta
   */
  extractFilterFields(query) {
    const fields = []

    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) { continue } // Ignorar operadores

      if (typeof value === 'object' && value !== null) {
        // Es un operador como $in, $gt, etc.
        fields.push(key)
      } else {
        fields.push(key)
      }
    }

    return fields
  }

  /**
   * Limpiar estadísticas de consultas
   */
  clearStats() {
    this.queryStats.clear()
    logger.info('Query statistics cleared')
  }
}

// Singleton instance
const queryOptimizer = new QueryOptimizer()

export default queryOptimizer
