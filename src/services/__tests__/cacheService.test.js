/**
 * Tests para Cache Service
 *
 * Verifica el correcto funcionamiento del sistema de caché con Redis.
 * Utiliza redis-mock para evitar dependencias de Redis real.
 */

import cacheService from '../cacheService.js'

// Constantes de test
const TEST_CACHE_PREFIX = 'test:'
const TEST_KEY = `${TEST_CACHE_PREFIX}user:123`
const TEST_VALUE = { id: '123', name: 'Test User', email: 'test@example.com' }
const TEST_TTL = 60 // 60 segundos

describe('Cache Service', () => {
  // Limpiar caché antes de cada test
  beforeEach(async () => {
    await cacheService.clear()
  })

  // Limpiar caché después de cada test
  afterEach(async () => {
    await cacheService.clear()
  })

  describe('set', () => {
    test('debe guardar un valor en caché', async () => {
      // Arrange
      const key = TEST_KEY
      const value = TEST_VALUE
      const ttl = TEST_TTL

      // Act
      const result = await cacheService.set(key, value, ttl)

      // Assert
      expect(result).toBe(true)
    })

    test('debe poder guardar strings', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}string`
      const value = 'test string'

      // Act
      const result = await cacheService.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    test('debe poder guardar números', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}number`
      const value = 42

      // Act
      const result = await cacheService.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    test('debe poder guardar objetos', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}object`
      const value = { prop: 'value', nested: { prop2: 'value2' } }

      // Act
      const result = await cacheService.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    test('debe poder guardar arrays', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}array`
      const value = [1, 2, 3, { item: 'test' }]

      // Act
      const result = await cacheService.set(key, value)

      // Assert
      expect(result).toBe(true)
    })

    test('debe usar TTL por defecto si no se especifica', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}default-ttl`
      const value = 'test'

      // Act
      const result = await cacheService.set(key, value) // Sin TTL

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('get', () => {
    test('debe recuperar un valor previamente guardado', async () => {
      // Arrange
      const key = TEST_KEY
      const value = TEST_VALUE
      await cacheService.set(key, value)

      // Act
      const retrieved = await cacheService.get(key)

      // Assert
      expect(retrieved).toEqual(value)
    })

    test('debe retornar null para key inexistente', async () => {
      // Arrange
      const nonExistentKey = `${TEST_CACHE_PREFIX}nonexistent`

      // Act
      const result = await cacheService.get(nonExistentKey)

      // Assert
      expect(result).toBeNull()
    })

    test('debe recuperar strings correctamente', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}string`
      const value = 'test string'
      await cacheService.set(key, value)

      // Act
      const retrieved = await cacheService.get(key)

      // Assert
      expect(retrieved).toBe(value)
    })

    test('debe recuperar números correctamente', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}number`
      const value = 42
      await cacheService.set(key, value)

      // Act
      const retrieved = await cacheService.get(key)

      // Assert
      expect(retrieved).toBe(value)
    })

    test('debe recuperar objetos correctamente', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}object`
      const value = { prop: 'value', nested: { prop2: 'value2' } }
      await cacheService.set(key, value)

      // Act
      const retrieved = await cacheService.get(key)

      // Assert
      expect(retrieved).toEqual(value)
    })

    test('debe recuperar arrays correctamente', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}array`
      const value = [1, 2, 3, { item: 'test' }]
      await cacheService.set(key, value)

      // Act
      const retrieved = await cacheService.get(key)

      // Assert
      expect(retrieved).toEqual(value)
    })
  })

  describe('del', () => {
    test('debe eliminar una key existente', async () => {
      // Arrange
      const key = TEST_KEY
      const value = TEST_VALUE
      await cacheService.set(key, value)

      // Act
      const result = await cacheService.del(key)

      // Assert
      expect(result).toBe(true)

      // Verify deletion
      const retrieved = await cacheService.get(key)
      expect(retrieved).toBeNull()
    })

    test('debe retornar false para key inexistente', async () => {
      // Arrange
      const nonExistentKey = `${TEST_CACHE_PREFIX}nonexistent`

      // Act
      const result = await cacheService.del(nonExistentKey)

      // Assert
      expect(result).toBe(false)
    })

    test('debe poder eliminar múltiples keys', async () => {
      // Arrange
      const keys = [
        `${TEST_CACHE_PREFIX}key1`,
        `${TEST_CACHE_PREFIX}key2`,
        `${TEST_CACHE_PREFIX}key3`
      ]

      // Set all keys
      for (const key of keys) {
        await cacheService.set(key, 'value')
      }

      // Act
      for (const key of keys) {
        await cacheService.del(key)
      }

      // Assert
      for (const key of keys) {
        const retrieved = await cacheService.get(key)
        expect(retrieved).toBeNull()
      }
    })
  })

  describe('exists', () => {
    test('debe retornar true para key existente', async () => {
      // Arrange
      const key = TEST_KEY
      const value = TEST_VALUE
      await cacheService.set(key, value)

      // Act
      const exists = await cacheService.exists(key)

      // Assert
      expect(exists).toBe(true)
    })

    test('debe retornar false para key inexistente', async () => {
      // Arrange
      const nonExistentKey = `${TEST_CACHE_PREFIX}nonexistent`

      // Act
      const exists = await cacheService.exists(nonExistentKey)

      // Assert
      expect(exists).toBe(false)
    })

    test('debe retornar false después de eliminar una key', async () => {
      // Arrange
      const key = TEST_KEY
      await cacheService.set(key, 'value')
      await cacheService.del(key)

      // Act
      const exists = await cacheService.exists(key)

      // Assert
      expect(exists).toBe(false)
    })
  })

  describe('clear', () => {
    test('debe limpiar todo el caché', async () => {
      // Arrange
      const keys = [
        `${TEST_CACHE_PREFIX}key1`,
        `${TEST_CACHE_PREFIX}key2`,
        `${TEST_CACHE_PREFIX}key3`
      ]

      // Set all keys
      for (const key of keys) {
        await cacheService.set(key, 'value')
      }

      // Act
      await cacheService.clear()

      // Assert
      for (const key of keys) {
        const retrieved = await cacheService.get(key)
        expect(retrieved).toBeNull()
      }
    })

    test('debe poder limpiar caché vacío sin errores', async () => {
      // Act & Assert
      await expect(cacheService.clear()).resolves.not.toThrow()
    })
  })

  describe('TTL (Time To Live)', () => {
    test('debe respetar el TTL configurado', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}ttl-test`
      const value = 'test'
      const ttl = 1 // 1 segundo

      // Act
      await cacheService.set(key, value, ttl)

      // Immediate retrieval should work
      const immediate = await cacheService.get(key)
      expect(immediate).toBe(value)

      // After TTL, should be null
      return new Promise((resolve) => {
        setTimeout(async () => {
          const afterTTL = await cacheService.get(key)
          expect(afterTTL).toBeNull()
          resolve()
        }, 1100) // Wait 1.1 seconds
      })
    }, 2000) // Test timeout de 2 segundos
  })

  describe('Manejo de errores', () => {
    test('no debe fallar con key vacía', async () => {
      // Act & Assert
      await expect(cacheService.get('')).resolves.toBeNull()
    })

    test('no debe fallar con value null', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}null-value`

      // Act
      const result = await cacheService.set(key, null)

      // Assert
      expect(result).toBe(true)
    })

    test('no debe fallar con value undefined', async () => {
      // Arrange
      const key = `${TEST_CACHE_PREFIX}undefined-value`

      // Act
      const result = await cacheService.set(key, undefined)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('Keys con prefijos', () => {
    test('debe soportar keys con diferentes prefijos', async () => {
      // Arrange
      const keys = [
        'user:123',
        'post:456',
        'reel:789'
      ]

      // Act
      for (const key of keys) {
        await cacheService.set(key, { data: key })
      }

      // Assert
      for (const key of keys) {
        const retrieved = await cacheService.get(key)
        expect(retrieved).toEqual({ data: key })
      }
    })

    test('debe poder eliminar keys por patrón (invalidación)', async () => {
      // Arrange
      const userKeys = [
        'user:123',
        'user:456',
        'user:789'
      ]

      const otherKeys = [
        'post:123',
        'reel:456'
      ]

      // Set all keys
      for (const key of [...userKeys, ...otherKeys]) {
        await cacheService.set(key, 'value')
      }

      // Act - Simulate invalidating all user keys
      for (const key of userKeys) {
        await cacheService.del(key)
      }

      // Assert - User keys deleted
      for (const key of userKeys) {
        const retrieved = await cacheService.get(key)
        expect(retrieved).toBeNull()
      }

      // Assert - Other keys still exist
      for (const key of otherKeys) {
        const retrieved = await cacheService.get(key)
        expect(retrieved).toBe('value')
      }
    })
  })
})
