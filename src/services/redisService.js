/**
 * Servicio de Redis para caché y blacklist de tokens
 * Incluye fallback para desarrollo sin Redis
 */

import { createClient } from 'redis'
import { config } from '../utils/config.js'
import logger from '../utils/logger.js'

class RedisService {
  constructor() {
    this.client = null
    this.connected = false
    this.memoryStore = new Map() // Fallback para desarrollo sin Redis
  }

  /**
   * Conectar a Redis
   */
  async connect() {
    // Si no hay Redis URL, usar memoria (desarrollo)
    if (!config.redisUrl) {
      logger.warn('Redis no configurado, usando almacenamiento en memoria (solo para desarrollo)')
      this.connected = true
      return
    }

    try {
      this.client = createClient({
        url: config.redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis: máximo de reconexiones alcanzado')
              return new Error('Max retries reached')
            }
            // Espera exponencial: 50ms, 100ms, 200ms, etc.
            return Math.min(retries * 50, 3000)
          }
        }
      })

      this.client.on('error', (err) => {
        logger.error('Redis Error:', err)
      })

      this.client.on('connect', () => {
        logger.info('Redis conectado exitosamente')
      })

      this.client.on('ready', () => {
        logger.info('Redis listo para usar')
        this.connected = true
      })

      this.client.on('reconnecting', () => {
        logger.warn('Redis reconectando...')
      })

      await this.client.connect()
    } catch (error) {
      logger.error('Error al conectar Redis, usando almacenamiento en memoria:', error)
      this.client = null
      this.connected = true // Permitir continuar con memoria
    }
  }

  /**
   * Desconectar de Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit()
      logger.info('Redis desconectado')
    }
  }

  /**
   * Guardar valor en Redis/Memoria
   * @param {string} key - Clave
   * @param {string} value - Valor
   * @param {number} ttl - Tiempo de vida en segundos
   */
  async set(key, value, ttl = null) {
    try {
      if (this.client) {
        if (ttl) {
          await this.client.setEx(key, ttl, value)
        } else {
          await this.client.set(key, value)
        }
      } else {
        // Fallback a memoria
        const expiresAt = ttl ? Date.now() + ttl * 1000 : null
        this.memoryStore.set(key, { value, expiresAt })
      }
    } catch (error) {
      logger.error(`Error al guardar en Redis/Memoria (${key}):`, error)
    }
  }

  /**
   * Obtener valor de Redis/Memoria
   * @param {string} key - Clave
   * @returns {Promise<string|null>}
   */
  async get(key) {
    try {
      if (this.client) {
        return await this.client.get(key)
      } else {
        // Fallback a memoria
        const item = this.memoryStore.get(key)
        if (!item) return null

        // Verificar expiración
        if (item.expiresAt && Date.now() > item.expiresAt) {
          this.memoryStore.delete(key)
          return null
        }

        return item.value
      }
    } catch (error) {
      logger.error(`Error al obtener de Redis/Memoria (${key}):`, error)
      return null
    }
  }

  /**
   * Eliminar valor de Redis/Memoria
   * @param {string} key - Clave
   */
  async del(key) {
    try {
      if (this.client) {
        await this.client.del(key)
      } else {
        this.memoryStore.delete(key)
      }
    } catch (error) {
      logger.error(`Error al eliminar de Redis/Memoria (${key}):`, error)
    }
  }

  /**
   * Verificar si una clave existe
   * @param {string} key - Clave
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      if (this.client) {
        const result = await this.client.exists(key)
        return result === 1
      } else {
        const item = this.memoryStore.get(key)
        if (!item) return false

        // Verificar expiración
        if (item.expiresAt && Date.now() > item.expiresAt) {
          this.memoryStore.delete(key)
          return false
        }

        return true
      }
    } catch (error) {
      logger.error(`Error al verificar existencia en Redis/Memoria (${key}):`, error)
      return false
    }
  }

  /**
   * Obtener todas las claves que coinciden con un patrón
   * @param {string} pattern - Patrón (ej: 'blacklist:*')
   * @returns {Promise<string[]>}
   */
  async keys(pattern) {
    try {
      if (this.client) {
        return await this.client.keys(pattern)
      } else {
        // Fallback a memoria con regex
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$')
        return Array.from(this.memoryStore.keys()).filter(key => regex.test(key))
      }
    } catch (error) {
      logger.error(`Error al buscar claves en Redis/Memoria (${pattern}):`, error)
      return []
    }
  }

  /**
   * Incrementar contador
   * @param {string} key - Clave
   * @returns {Promise<number>}
   */
  async incr(key) {
    try {
      if (this.client) {
        return await this.client.incr(key)
      } else {
        const item = this.memoryStore.get(key)
        const value = item ? parseInt(item.value || '0') + 1 : 1
        this.memoryStore.set(key, { value: value.toString(), expiresAt: null })
        return value
      }
    } catch (error) {
      logger.error(`Error al incrementar en Redis/Memoria (${key}):`, error)
      return 0
    }
  }

  /**
   * Establecer expiración de una clave
   * @param {string} key - Clave
   * @param {number} ttl - Tiempo de vida en segundos
   */
  async expire(key, ttl) {
    try {
      if (this.client) {
        await this.client.expire(key, ttl)
      } else {
        const item = this.memoryStore.get(key)
        if (item) {
          item.expiresAt = Date.now() + ttl * 1000
          this.memoryStore.set(key, item)
        }
      }
    } catch (error) {
      logger.error(`Error al establecer expiración en Redis/Memoria (${key}):`, error)
    }
  }

  /**
   * Limpiar claves expiradas del almacenamiento en memoria
   * (Solo necesario para fallback de memoria)
   */
  cleanupExpired() {
    if (!this.client) {
      const now = Date.now()
      for (const [key, item] of this.memoryStore.entries()) {
        if (item.expiresAt && now > item.expiresAt) {
          this.memoryStore.delete(key)
        }
      }
    }
  }
}

// Singleton
const redisService = new RedisService()

// Limpiar memoria cada 5 minutos
setInterval(() => {
  redisService.cleanupExpired()
}, 5 * 60 * 1000)

export default redisService

