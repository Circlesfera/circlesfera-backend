const mongoose = require('mongoose')
const logger = require('./logger')
const monitoringService = require('./monitoring')

/**
 * Optimizador de consultas de base de datos para CircleSfera
 * Proporciona utilidades para optimizar consultas y agregar índices
 */
class DatabaseOptimizer {
  constructor() {
    this.indexes = new Map()
    this.queryCache = new Map()
    this.slowQueryThreshold = 1000 // 1 segundo
  }

  /**
   * Ejecutar consulta con monitoreo de performance
   * @param {Function} queryFunction - Función que ejecuta la consulta
   * @param {string} operation - Nombre de la operación
   * @returns {Promise<any>}
   */
  async executeQuery(queryFunction, operation = 'unknown') {
    const startTime = Date.now()

    try {
      const result = await queryFunction()
      const queryTime = Date.now() - startTime

      // Registrar métricas
      monitoringService.recordDbQuery(queryTime)

      // Log de consultas lentas
      if (queryTime > this.slowQueryThreshold) {
        logger.warn('Consulta lenta detectada:', {
          operation,
          queryTime,
          threshold: this.slowQueryThreshold
        })
      }

      return result
    } catch (error) {
      const queryTime = Date.now() - startTime
      monitoringService.recordDbQuery(queryTime)

      logger.error('Error en consulta de base de datos:', {
        operation,
        queryTime,
        error: error.message
      })

      throw error
    }
  }

  /**
   * Crear índices optimizados para las colecciones principales
   */
  async createOptimizedIndexes() {
    try {
      logger.info('Creando índices optimizados...')

      // Índices para User
      await this.createUserIndexes()

      // Índices para Post
      await this.createPostIndexes()

      // Índices para Reel
      await this.createReelIndexes()

      // Índices para Story
      await this.createStoryIndexes()

      // Índices para Comment
      await this.createCommentIndexes()

      // Índices para Notification
      await this.createNotificationIndexes()

      // Índices para LiveStream
      await this.createLiveStreamIndexes()

      // Índices para CSTV
      await this.createCSTVIndexes()

      // Índices para Conversation
      await this.createConversationIndexes()

      // Índices para Message
      await this.createMessageIndexes()

      logger.info('Índices optimizados creados exitosamente')
    } catch (error) {
      logger.error('Error creando índices:', error)
      throw error
    }
  }

  /**
   * Crear índices para la colección User
   */
  async createUserIndexes() {
    const User = mongoose.model('User')

    const indexes = [
      // Índice único para username
      { username: 1 },
      // Índice único para email
      { email: 1 },
      // Índice compuesto para búsquedas
      { username: 1, isActive: 1 },
      // Índice para búsquedas de texto
      { username: 'text', fullName: 'text' },
      // Índice para followers/following
      { 'followers': 1 },
      { 'following': 1 },
      // Índice para usuarios verificados
      { isVerified: 1, isActive: 1 },
      // Índice para configuración de privacidad
      { isPrivate: 1, isActive: 1 }
    ]

    for (const index of indexes) {
      await this.createIndex(User, index)
    }
  }

  /**
   * Crear índices para la colección Post
   */
  async createPostIndexes() {
    const Post = mongoose.model('Post')

    const indexes = [
      // Índice compuesto para feed
      { user: 1, createdAt: -1, isDeleted: 1, isPublic: 1 },
      // Índice para likes
      { 'likes': 1, createdAt: -1 },
      // Índice para búsquedas por ubicación
      { 'location.coordinates': '2dsphere' },
      // Índice para tags
      { tags: 1, createdAt: -1 },
      // Índice para posts públicos
      { isPublic: 1, createdAt: -1 },
      // Índice para tipo de contenido
      { type: 1, createdAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Post, index)
    }
  }

  /**
   * Crear índices para la colección Reel
   */
  async createReelIndexes() {
    const Reel = mongoose.model('Reel')

    const indexes = [
      // Índice compuesto para feed de reels
      { user: 1, createdAt: -1, isDeleted: 1, isPublic: 1 },
      // Índice para likes
      { 'likes': 1, createdAt: -1 },
      // Índice para hashtags
      { hashtags: 1, createdAt: -1 },
      // Índice para ubicación
      { location: 1, createdAt: -1 },
      // Índice para reels públicos
      { isPublic: 1, createdAt: -1 },
      // Índice para trending
      { views: 1, likes: 1, createdAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Reel, index)
    }
  }

  /**
   * Crear índices para la colección Story
   */
  async createStoryIndexes() {
    const Story = mongoose.model('Story')

    const indexes = [
      // Índice compuesto para feed de stories
      { user: 1, createdAt: -1, expiresAt: 1, isDeleted: 1 },
      // Índice para stories activas
      { expiresAt: 1, isDeleted: 1, isPublic: 1 },
      // Índice para tipo de historia
      { type: 1, createdAt: -1 },
      // Índice para ubicación
      { 'location.coordinates': '2dsphere' },
      // Índice para limpieza de stories expiradas
      { expiresAt: 1, isDeleted: 1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Story, index)
    }
  }

  /**
   * Crear índices para la colección Comment
   */
  async createCommentIndexes() {
    const Comment = mongoose.model('Comment')

    const indexes = [
      // Índice compuesto para comentarios de posts
      { post: 1, createdAt: -1, isDeleted: 1 },
      // Índice para comentarios padre
      { parentComment: 1, createdAt: 1 },
      // Índice para usuario
      { user: 1, createdAt: -1 },
      // Índice para likes
      { 'likes': 1, createdAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Comment, index)
    }
  }

  /**
   * Crear índices para la colección Notification
   */
  async createNotificationIndexes() {
    const Notification = mongoose.model('Notification')

    const indexes = [
      // Índice compuesto para notificaciones del usuario
      { user: 1, createdAt: -1, isDeleted: 1 },
      // Índice para notificaciones no leídas
      { user: 1, isRead: 1, isDeleted: 1 },
      // Índice para tipo de notificación
      { type: 1, createdAt: -1 },
      // Índice para limpieza de notificaciones antiguas
      { createdAt: 1, isRead: 1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Notification, index)
    }
  }

  /**
   * Crear índices para la colección LiveStream
   */
  async createLiveStreamIndexes() {
    const LiveStream = mongoose.model('LiveStream')

    const indexes = [
      // Índice para streams activos
      { status: 1, createdAt: -1 },
      // Índice para streams del usuario
      { user: 1, createdAt: -1 },
      // Índice para streams programados
      { scheduledAt: 1, status: 1 },
      // Índice para streams públicos
      { isPublic: 1, status: 1, createdAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(LiveStream, index)
    }
  }

  /**
   * Crear índices para la colección CSTV
   */
  async createCSTVIndexes() {
    const CSTV = mongoose.model('CSTV')

    const indexes = [
      // Índice compuesto para videos CSTV
      { user: 1, createdAt: -1, isPublished: 1 },
      // Índice para categoría
      { category: 1, createdAt: -1 },
      // Índice para trending
      { views: 1, likes: 1, createdAt: -1 },
      // Índice para tags
      { tags: 1, createdAt: -1 },
      // Índice para videos publicados
      { isPublished: 1, createdAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(CSTV, index)
    }
  }

  /**
   * Crear índices para la colección Conversation
   */
  async createConversationIndexes() {
    const Conversation = mongoose.model('Conversation')

    const indexes = [
      // Índice para participantes
      { 'participants': 1, updatedAt: -1 },
      // Índice para tipo de conversación
      { type: 1, updatedAt: -1 },
      // Índice para conversaciones activas
      { isActive: 1, updatedAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Conversation, index)
    }
  }

  /**
   * Crear índices para la colección Message
   */
  async createMessageIndexes() {
    const Message = mongoose.model('Message')

    const indexes = [
      // Índice compuesto para mensajes de conversación
      { conversation: 1, createdAt: -1 },
      // Índice para remitente
      { sender: 1, createdAt: -1 },
      // Índice para tipo de mensaje
      { type: 1, createdAt: -1 },
      // Índice para mensajes no leídos
      { 'readBy': 1, createdAt: -1 }
    ]

    for (const index of indexes) {
      await this.createIndex(Message, index)
    }
  }

  /**
   * Crear un índice individual
   * @param {mongoose.Model} model - Modelo de Mongoose
   * @param {Object} index - Definición del índice
   */
  async createIndex(model, index) {
    try {
      await model.collection.createIndex(index)
      const indexName = JSON.stringify(index)
      this.indexes.set(indexName, true)
      logger.debug('Índice creado:', { model: model.modelName, index })
    } catch (error) {
      if (!error.message.includes('already exists')) {
        logger.error('Error creando índice:', { model: model.modelName, index, error: error.message })
      }
    }
  }

  /**
   * Analizar y sugerir optimizaciones para una consulta
   * @param {Object} query - Consulta de Mongoose
   * @param {Object} options - Opciones de la consulta
   * @returns {Object} Sugerencias de optimización
   */
  analyzeQuery(query, options = {}) {
    const suggestions = []

    // Verificar si la consulta usa índices apropiados
    if (query.user && !options.sort) {
      suggestions.push({
        type: 'sort',
        message: 'Considera agregar ordenamiento por createdAt para mejor performance',
        suggestion: { sort: { createdAt: -1 } }
      })
    }

    // Verificar límites
    if (!options.limit) {
      suggestions.push({
        type: 'limit',
        message: 'Agrega un límite para evitar consultas grandes',
        suggestion: { limit: 20 }
      })
    }

    // Verificar campos seleccionados
    if (!options.select) {
      suggestions.push({
        type: 'select',
        message: 'Especifica campos necesarios para reducir transferencia de datos',
        suggestion: { select: 'username avatar fullName createdAt' }
      })
    }

    return suggestions
  }

  /**
   * Obtener estadísticas de la base de datos
   * @returns {Promise<Object>}
   */
  async getDatabaseStats() {
    try {
      const stats = await mongoose.connection.db.stats()

      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexSize: stats.indexSize,
        totalSize: stats.dataSize + stats.indexSize,
        indexes: stats.indexes
      }
    } catch (error) {
      logger.error('Error obteniendo estadísticas de BD:', error)
      return null
    }
  }

  /**
   * Obtener información de índices
   * @returns {Promise<Object>}
   */
  async getIndexesInfo() {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray()
      const indexesInfo = {}

      for (const collection of collections) {
        const indexes = await mongoose.connection.db.collection(collection.name).indexes()
        indexesInfo[collection.name] = indexes.map(index => ({
          name: index.name,
          key: index.key,
          size: index.size || 0
        }))
      }

      return indexesInfo
    } catch (error) {
      logger.error('Error obteniendo información de índices:', error)
      return null
    }
  }
}

// Instancia singleton del optimizador
const dbOptimizer = new DatabaseOptimizer()

module.exports = dbOptimizer
