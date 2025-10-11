/* global process */

/**
 * Mock Manual de Redis para Tests
 *
 * Este archivo simula el módulo 'redis' usando 'redis-mock' para tests.
 * Jest carga automáticamente este mock cuando se importa 'redis' en tests.
 *
 * IMPORTANTE:
 * - Solo se usa en tests (NODE_ENV=test)
 * - En producción, se usa el módulo 'redis' real
 * - redis-mock está en devDependencies (NO se instala en producción)
 */

import redisMock from 'redis-mock'

/**
 * Crear cliente Redis simulado
 * Adapta redis-mock (API callback) a redis v4 (API Promise)
 *
 * @param {Object} options - Opciones de configuración del cliente
 * @param {string} options.url - URL de conexión de Redis
 * @param {Object} options.socket - Configuración de socket
 * @param {number} options.database - Número de base de datos
 * @returns {Object} Cliente Redis mock con API de Promises
 */
export const createClient = (options = {}) => {
  // ✅ IMPLEMENTADO: Procesar y almacenar opciones
  const config = {
    url: options?.url || 'redis://localhost:6379',
    socket: options?.socket || {},
    database: options?.database || 0
  }

  const client = redisMock.createClient()

  // Agregar configuración al cliente para acceso en tests
  client.__mockConfig = config
  client.__isConnected = false

  // Logging para debugging de tests (solo si DEBUG_REDIS está activo)
  if (process.env.NODE_ENV === 'test' && process.env.DEBUG_REDIS) {
    console.log('Redis Mock creado con config:', config)
  }

  // Adaptar redis-mock a la API de redis v4 (async/await)
  const wrappedClient = {
    // Mantener acceso al cliente original y config
    _originalClient: client,
    _config: config,

    // ✅ CORREGIDO: Métodos de conexión simplificados
    connect: () => {
      client.__isConnected = true
      return Promise.resolve()
    },

    disconnect: () => {
      client.__isConnected = false
      return Promise.resolve()
    },

    quit: () => {
      client.__isConnected = false
      return Promise.resolve()
    },

    // Event handlers
    on: (event, handler) => {
      client.on(event, handler)
    },

    // ✅ CORREGIDO: Comandos Redis convertidos a Promises
    get: (key) => new Promise((resolve, reject) => {
      client.get(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    set: (key, value, options) => new Promise((resolve, reject) => {
      // ✅ CORREGIDO: If/else con llaves
      if (options?.EX) {
        // Setex con expiración en segundos
        client.setex(key, options.EX, value, (err, reply) => {
          if (err) {
            reject(err)
          } else {
            resolve(reply === 'OK' ? 'OK' : reply)
          }
        })
      } else if (options?.PX) {
        // Psetex con expiración en milisegundos
        const seconds = Math.ceil(options.PX / 1000)
        client.setex(key, seconds, value, (err, reply) => {
          if (err) {
            reject(err)
          } else {
            resolve(reply === 'OK' ? 'OK' : reply)
          }
        })
      } else {
        client.set(key, value, (err, reply) => {
          if (err) {
            reject(err)
          } else {
            resolve(reply === 'OK' ? 'OK' : reply)
          }
        })
      }
    }),

    del: (key) => new Promise((resolve, reject) => {
      client.del(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    exists: (key) => new Promise((resolve, reject) => {
      client.exists(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    expire: (key, seconds) => new Promise((resolve, reject) => {
      client.expire(key, seconds, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    ttl: (key) => new Promise((resolve, reject) => {
      client.ttl(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    keys: (pattern) => new Promise((resolve, reject) => {
      client.keys(pattern, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply || [])
        }
      })
    }),

    flushDb: () => new Promise((resolve, reject) => {
      client.flushdb((err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    flushAll: () => new Promise((resolve, reject) => {
      client.flushall((err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    // Comandos adicionales que puede usar cacheService
    incr: (key) => new Promise((resolve, reject) => {
      client.incr(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    decr: (key) => new Promise((resolve, reject) => {
      client.decr(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    hGet: (key, field) => new Promise((resolve, reject) => {
      client.hget(key, field, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    hSet: (key, field, value) => new Promise((resolve, reject) => {
      client.hset(key, field, value, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    hGetAll: (key) => new Promise((resolve, reject) => {
      client.hgetall(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply || {})
        }
      })
    }),

    sAdd: (key, ...members) => new Promise((resolve, reject) => {
      client.sadd(key, ...members, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply)
        }
      })
    }),

    sMembers: (key) => new Promise((resolve, reject) => {
      client.smembers(key, (err, reply) => {
        if (err) {
          reject(err)
        } else {
          resolve(reply || [])
        }
      })
    })
  }

  return wrappedClient
}
