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
 */
export const createClient = (options) => {
  const client = redisMock.createClient()

  // Adaptar redis-mock a la API de redis v4 (async/await)
  const wrappedClient = {
    // Mantener acceso al cliente original
    _originalClient: client,

    // Métodos de conexión (redis-mock se conecta automáticamente)
    connect: async () => {
      return Promise.resolve()
    },
    disconnect: async () => {
      return Promise.resolve()
    },
    quit: async () => {
      return Promise.resolve()
    },

    // Event handlers
    on: (event, handler) => {
      client.on(event, handler)
    },

    // Comandos Redis convertidos a Promises
    get: (key) => {
      return new Promise((resolve, reject) => {
        client.get(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    set: (key, value, options) => {
      return new Promise((resolve, reject) => {
        if (options?.EX) {
          // Setex con expiración en segundos
          client.setex(key, options.EX, value, (err, reply) => {
            if (err) reject(err)
            else resolve(reply === 'OK' ? 'OK' : reply)
          })
        } else if (options?.PX) {
          // Psetex con expiración en milisegundos
          const seconds = Math.ceil(options.PX / 1000)
          client.setex(key, seconds, value, (err, reply) => {
            if (err) reject(err)
            else resolve(reply === 'OK' ? 'OK' : reply)
          })
        } else {
          client.set(key, value, (err, reply) => {
            if (err) reject(err)
            else resolve(reply === 'OK' ? 'OK' : reply)
          })
        }
      })
    },

    del: (key) => {
      return new Promise((resolve, reject) => {
        client.del(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    exists: (key) => {
      return new Promise((resolve, reject) => {
        client.exists(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    expire: (key, seconds) => {
      return new Promise((resolve, reject) => {
        client.expire(key, seconds, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    ttl: (key) => {
      return new Promise((resolve, reject) => {
        client.ttl(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    keys: (pattern) => {
      return new Promise((resolve, reject) => {
        client.keys(pattern, (err, reply) => {
          if (err) reject(err)
          else resolve(reply || [])
        })
      })
    },

    flushDb: () => {
      return new Promise((resolve, reject) => {
        client.flushdb((err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    flushAll: () => {
      return new Promise((resolve, reject) => {
        client.flushall((err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    // Comandos adicionales que puede usar cacheService
    incr: (key) => {
      return new Promise((resolve, reject) => {
        client.incr(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    decr: (key) => {
      return new Promise((resolve, reject) => {
        client.decr(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    hGet: (key, field) => {
      return new Promise((resolve, reject) => {
        client.hget(key, field, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    hSet: (key, field, value) => {
      return new Promise((resolve, reject) => {
        client.hset(key, field, value, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    hGetAll: (key) => {
      return new Promise((resolve, reject) => {
        client.hgetall(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply || {})
        })
      })
    },

    sAdd: (key, ...members) => {
      return new Promise((resolve, reject) => {
        client.sadd(key, ...members, (err, reply) => {
          if (err) reject(err)
          else resolve(reply)
        })
      })
    },

    sMembers: (key) => {
      return new Promise((resolve, reject) => {
        client.smembers(key, (err, reply) => {
          if (err) reject(err)
          else resolve(reply || [])
        })
      })
    }
  }

  return wrappedClient
}

