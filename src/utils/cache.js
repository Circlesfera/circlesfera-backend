const logger = require('./logger')

/**
 * Sistema de caché en memoria para CircleSfera
 * Implementa un caché simple pero eficiente para mejorar performance
 */
class MemoryCache {
  constructor() {
    this.cache = new Map()
    this.ttlMap = new Map()
    this.maxSize = 1000 // Máximo 1000 entradas
    this.cleanupInterval = 60000 // Limpiar cada minuto

    // Iniciar limpieza automática
    this.startCleanup()
  }

  /**
   * Obtener valor del caché
   * @param {string} key - Clave del caché
   * @returns {any} Valor almacenado o null si no existe/expirado
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null
    }

    const ttl = this.ttlMap.get(key)
    if (ttl && Date.now() > ttl) {
      this.delete(key)
      return null
    }

    logger.debug('Cache hit:', { key })
    return this.cache.get(key)
  }

  /**
   * Almacenar valor en caché
   * @param {string} key - Clave del caché
   * @param {any} value - Valor a almacenar
   * @param {number} ttlSeconds - Tiempo de vida en segundos
   */
  set(key, value, ttlSeconds = 300) {
    // Limpiar caché si está lleno
    if (this.cache.size >= this.maxSize) {
      this.cleanup()
    }

    this.cache.set(key, value)
    this.ttlMap.set(key, Date.now() + (ttlSeconds * 1000))

    logger.debug('Cache set:', { key, ttlSeconds })
  }

  /**
   * Eliminar entrada del caché
   * @param {string} key - Clave a eliminar
   */
  delete(key) {
    this.cache.delete(key)
    this.ttlMap.delete(key)
    logger.debug('Cache delete:', { key })
  }

  /**
   * Eliminar entradas que coincidan con un patrón
   * @param {string} pattern - Patrón a buscar (usando includes)
   */
  deletePattern(pattern) {
    let deletedCount = 0

    for (const key of this.cache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        this.delete(key)
        deletedCount++
      }
    }

    logger.debug('Cache delete pattern:', { pattern, deletedCount })
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanup() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, ttl] of this.ttlMap.entries()) {
      if (now > ttl) {
        this.delete(key)
        cleanedCount++
      }
    }

    // Si aún está lleno, eliminar entradas más antiguas
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries())
      const toDelete = entries.slice(0, Math.floor(this.maxSize * 0.1)) // Eliminar 10%

      for (const [key] of toDelete) {
        this.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cache cleanup completed:', { cleanedCount, remaining: this.cache.size })
    }
  }

  /**
   * Iniciar limpieza automática
   */
  startCleanup() {
    setInterval(() => {
      this.cleanup()
    }, this.cleanupInterval)
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitRate || 0,
      entries: Array.from(this.cache.keys())
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    this.cache.clear()
    this.ttlMap.clear()
    logger.info('Cache cleared')
  }
}

// Instancia singleton del caché
const cache = new MemoryCache()

module.exports = cache
