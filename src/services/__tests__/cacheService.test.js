/**
 * Tests para cacheService
 * Fase 3: Testing + CI/CD
 */

import { jest } from '@jest/globals'
import cacheService from '../cacheService.js'
import redisService from '../redisService.js'

// Mock de redisService
jest.mock('../redisService.js', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn()
  }
}))

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('get', () => {
    it('debe obtener y parsear JSON del caché', async () => {
      const testData = { name: 'test', value: 123 }
      redisService.get.mockResolvedValue(JSON.stringify(testData))

      const result = await cacheService.get('test:key')

      expect(result).toEqual(testData)
      expect(redisService.get).toHaveBeenCalledWith('test:key')
    })

    it('debe devolver string si no es JSON', async () => {
      redisService.get.mockResolvedValue('plain string')

      const result = await cacheService.get('test:key')

      expect(result).toBe('plain string')
    })

    it('debe devolver null si no existe', async () => {
      redisService.get.mockResolvedValue(null)

      const result = await cacheService.get('test:key')

      expect(result).toBeNull()
    })

    it('debe manejar errores y devolver null', async () => {
      redisService.get.mockRejectedValue(new Error('Redis error'))

      const result = await cacheService.get('test:key')

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('debe serializar y guardar objeto en caché', async () => {
      const testData = { name: 'test', value: 123 }
      redisService.set.mockResolvedValue(undefined)

      const result = await cacheService.set('test:key', testData, 300)

      expect(result).toBe(true)
      expect(redisService.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify(testData),
        300
      )
    })

    it('debe guardar string directamente', async () => {
      redisService.set.mockResolvedValue(undefined)

      const result = await cacheService.set('test:key', 'plain string', 300)

      expect(result).toBe(true)
      expect(redisService.set).toHaveBeenCalledWith(
        'test:key',
        'plain string',
        300
      )
    })

    it('debe guardar sin TTL si no se especifica', async () => {
      redisService.set.mockResolvedValue(undefined)

      await cacheService.set('test:key', 'value')

      expect(redisService.set).toHaveBeenCalledWith(
        'test:key',
        'value',
        null
      )
    })

    it('debe devolver false en caso de error', async () => {
      redisService.set.mockRejectedValue(new Error('Redis error'))

      const result = await cacheService.set('test:key', 'value')

      expect(result).toBe(false)
    })
  })

  describe('del', () => {
    it('debe eliminar clave del caché', async () => {
      redisService.del.mockResolvedValue(undefined)

      const result = await cacheService.del('test:key')

      expect(result).toBe(true)
      expect(redisService.del).toHaveBeenCalledWith('test:key')
    })

    it('debe devolver false en caso de error', async () => {
      redisService.del.mockRejectedValue(new Error('Redis error'))

      const result = await cacheService.del('test:key')

      expect(result).toBe(false)
    })
  })

  describe('delPattern', () => {
    it('debe eliminar múltiples claves por patrón', async () => {
      redisService.keys.mockResolvedValue(['key1', 'key2', 'key3'])
      redisService.del.mockResolvedValue(undefined)

      const result = await cacheService.delPattern('test:*')

      expect(result).toBe(3)
      expect(redisService.keys).toHaveBeenCalledWith('test:*')
      expect(redisService.del).toHaveBeenCalledTimes(3)
    })

    it('debe devolver 0 si no hay claves', async () => {
      redisService.keys.mockResolvedValue([])

      const result = await cacheService.delPattern('test:*')

      expect(result).toBe(0)
      expect(redisService.del).not.toHaveBeenCalled()
    })

    it('debe manejar errores y devolver 0', async () => {
      redisService.keys.mockRejectedValue(new Error('Redis error'))

      const result = await cacheService.delPattern('test:*')

      expect(result).toBe(0)
    })
  })

  describe('getOrSet', () => {
    it('debe devolver valor del caché si existe (cache hit)', async () => {
      const cachedData = { name: 'cached' }
      redisService.get.mockResolvedValue(JSON.stringify(cachedData))

      const fn = jest.fn().mockResolvedValue({ name: 'fresh' })
      const result = await cacheService.getOrSet('test:key', fn, 300)

      expect(result).toEqual(cachedData)
      expect(fn).not.toHaveBeenCalled() // No debe ejecutar función
      expect(redisService.set).not.toHaveBeenCalled()
    })

    it('debe ejecutar función y cachear resultado (cache miss)', async () => {
      redisService.get.mockResolvedValue(null) // Cache miss
      redisService.set.mockResolvedValue(undefined)

      const freshData = { name: 'fresh' }
      const fn = jest.fn().mockResolvedValue(freshData)

      const result = await cacheService.getOrSet('test:key', fn, 300)

      expect(result).toEqual(freshData)
      expect(fn).toHaveBeenCalled()
      expect(redisService.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify(freshData),
        300
      )
    })

    it('no debe cachear resultado null', async () => {
      redisService.get.mockResolvedValue(null)

      const fn = jest.fn().mockResolvedValue(null)
      const result = await cacheService.getOrSet('test:key', fn, 300)

      expect(result).toBeNull()
      expect(redisService.set).not.toHaveBeenCalled()
    })

    it('no debe cachear resultado undefined', async () => {
      redisService.get.mockResolvedValue(null)

      const fn = jest.fn().mockResolvedValue(undefined)
      const result = await cacheService.getOrSet('test:key', fn, 300)

      expect(result).toBeUndefined()
      expect(redisService.set).not.toHaveBeenCalled()
    })
  })

  describe('getUserProfile', () => {
    it('debe obtener perfil de usuario del caché', async () => {
      const profile = { username: 'testuser', followers: 100 }
      redisService.get.mockResolvedValue(JSON.stringify(profile))

      const result = await cacheService.getUserProfile('testuser')

      expect(result).toEqual(profile)
      expect(redisService.get).toHaveBeenCalledWith('user:profile:testuser')
    })

    it('debe normalizar username a lowercase', async () => {
      redisService.get.mockResolvedValue(null)

      await cacheService.getUserProfile('TestUser')

      expect(redisService.get).toHaveBeenCalledWith('user:profile:testuser')
    })
  })

  describe('setUserProfile', () => {
    it('debe guardar perfil de usuario en caché', async () => {
      const profile = { username: 'testuser', followers: 100 }
      redisService.set.mockResolvedValue(undefined)

      const result = await cacheService.setUserProfile('testuser', profile)

      expect(result).toBe(true)
      expect(redisService.set).toHaveBeenCalledWith(
        'user:profile:testuser',
        JSON.stringify(profile),
        cacheService.TTL.USER_PROFILE
      )
    })
  })

  describe('invalidateUserProfile', () => {
    it('debe invalidar perfil de usuario', async () => {
      redisService.del.mockResolvedValue(undefined)

      const result = await cacheService.invalidateUserProfile('testuser')

      expect(result).toBe(true)
      expect(redisService.del).toHaveBeenCalledWith('user:profile:testuser')
    })
  })

  describe('getFeed', () => {
    it('debe obtener feed paginado del caché', async () => {
      const feed = { posts: [], pagination: {} }
      redisService.get.mockResolvedValue(JSON.stringify(feed))

      const result = await cacheService.getFeed('user123', 2)

      expect(result).toEqual(feed)
      expect(redisService.get).toHaveBeenCalledWith('feed:user123:page:2')
    })

    it('debe usar página 1 por defecto', async () => {
      redisService.get.mockResolvedValue(null)

      await cacheService.getFeed('user123')

      expect(redisService.get).toHaveBeenCalledWith('feed:user123:page:1')
    })
  })

  describe('invalidateFeed', () => {
    it('debe invalidar todas las páginas del feed de usuario', async () => {
      redisService.keys.mockResolvedValue([
        'feed:user123:page:1',
        'feed:user123:page:2',
        'feed:user123:page:3'
      ])
      redisService.del.mockResolvedValue(undefined)

      const result = await cacheService.invalidateFeed('user123')

      expect(result).toBe(3)
      expect(redisService.keys).toHaveBeenCalledWith('feed:user123:*')
      expect(redisService.del).toHaveBeenCalledTimes(3)
    })
  })

  describe('invalidateFollowersFeeds', () => {
    it('debe invalidar feeds de múltiples seguidores', async () => {
      const followerIds = ['user1', 'user2', 'user3']
      redisService.keys.mockResolvedValue(['feed:user1:page:1'])
      redisService.del.mockResolvedValue(undefined)

      const result = await cacheService.invalidateFollowersFeeds(followerIds)

      expect(result).toBeGreaterThan(0)
      expect(redisService.keys).toHaveBeenCalledTimes(3)
    })

    it('debe manejar array vacío', async () => {
      const result = await cacheService.invalidateFollowersFeeds([])

      expect(result).toBe(0)
      expect(redisService.keys).not.toHaveBeenCalled()
    })
  })

  describe('getTrendingPosts', () => {
    it('debe obtener posts trending del caché', async () => {
      const trending = [{ id: 1 }, { id: 2 }]
      redisService.get.mockResolvedValue(JSON.stringify(trending))

      const result = await cacheService.getTrendingPosts()

      expect(result).toEqual(trending)
      expect(redisService.get).toHaveBeenCalledWith('trending:posts')
    })
  })

  describe('setTrendingPosts', () => {
    it('debe guardar posts trending en caché', async () => {
      const trending = [{ id: 1 }, { id: 2 }]
      redisService.set.mockResolvedValue(undefined)

      const result = await cacheService.setTrendingPosts(trending)

      expect(result).toBe(true)
      expect(redisService.set).toHaveBeenCalledWith(
        'trending:posts',
        JSON.stringify(trending),
        cacheService.TTL.TRENDING_POSTS
      )
    })
  })

  describe('getStats', () => {
    it('debe obtener estadísticas de caché', async () => {
      redisService.keys
        .mockResolvedValueOnce(['user:profile:1', 'user:profile:2'])
        .mockResolvedValueOnce(['feed:1:page:1'])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(['post:1'])
        .mockResolvedValueOnce(['reel:1', 'reel:2'])

      const stats = await cacheService.getStats()

      expect(stats).toEqual({
        'User Profiles': 2,
        'Feeds': 1,
        'Stories': 0,
        'Posts': 1,
        'Reels': 2
      })
    })

    it('debe devolver objeto vacío en caso de error', async () => {
      redisService.keys.mockRejectedValue(new Error('Redis error'))

      const stats = await cacheService.getStats()

      expect(stats).toEqual({})
    })
  })

  describe('flush', () => {
    it('debe limpiar todo el caché', async () => {
      redisService.keys.mockResolvedValue(['key1', 'key2', 'key3'])
      redisService.del.mockResolvedValue(undefined)

      const result = await cacheService.flush()

      expect(result).toBe(3)
      expect(redisService.keys).toHaveBeenCalledWith('*')
      expect(redisService.del).toHaveBeenCalledTimes(3)
    })
  })
})

