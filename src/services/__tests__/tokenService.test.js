/**
 * Tests para tokenService
 * Fase 3: Testing + CI/CD
 */

import { jest } from '@jest/globals'
import jwt from 'jsonwebtoken'

// Mock de redisService ANTES de importar tokenService
const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn()
}

jest.unstable_mockModule('../redisService.js', () => ({
  default: mockRedisService
}))

// Importar tokenService DESPUÉS de mockear redisService
const { default: tokenService } = await import('../tokenService.js')

// Mock de config
jest.mock('../../utils/config.js', () => ({
  config: {
    jwtSecret: 'test-secret-key',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '30d'
  }
}))

describe('TokenService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mocks
    mockRedisService.get.mockReset()
    mockRedisService.set.mockReset()
    mockRedisService.del.mockReset()
    mockRedisService.exists.mockReset()
    mockRedisService.keys.mockReset()
  })

  describe('generateAccessToken', () => {
    it('debe generar un access token válido', () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      const decoded = jwt.decode(token)
      expect(decoded.id).toBe(userId)
      expect(decoded.type).toBe('access')
    })

    it('debe incluir tiempo de expiración', () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      const decoded = jwt.decode(token)
      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
    })
  })

  describe('generateRefreshToken', () => {
    it('debe generar un refresh token válido', () => {
      const userId = 'user123'
      const token = tokenService.generateRefreshToken(userId)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      const decoded = jwt.decode(token)
      expect(decoded.id).toBe(userId)
      expect(decoded.type).toBe('refresh')
    })
  })

  describe('generateTokenPair', () => {
    it('debe generar par de tokens (access + refresh)', () => {
      const userId = 'user123'
      const tokens = tokenService.generateTokenPair(userId)

      expect(tokens).toHaveProperty('accessToken')
      expect(tokens).toHaveProperty('refreshToken')
      expect(typeof tokens.accessToken).toBe('string')
      expect(typeof tokens.refreshToken).toBe('string')

      const accessDecoded = jwt.decode(tokens.accessToken)
      const refreshDecoded = jwt.decode(tokens.refreshToken)

      expect(accessDecoded.type).toBe('access')
      expect(refreshDecoded.type).toBe('refresh')
    })
  })

  describe('verifyToken', () => {
    it('debe verificar un token válido', async () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      mockRedisService.exists.mockResolvedValue(false) // No está en blacklist

      const decoded = await tokenService.verifyToken(token)

      expect(decoded).toBeDefined()
      expect(decoded.id).toBe(userId)
      expect(decoded.type).toBe('access')
    })

    it('debe rechazar token en blacklist', async () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      mockRedisService.exists.mockResolvedValue(true) // Está en blacklist

      const decoded = await tokenService.verifyToken(token)

      expect(decoded).toBeNull()
    })

    it('debe rechazar token expirado', async () => {
      // Generar token con expiración inmediata
      const token = jwt.sign(
        { id: 'user123', type: 'access' },
        'test-secret-key',
        { expiresIn: '0s' }
      )

      mockRedisService.exists.mockResolvedValue(false)

      // Esperar un momento para que expire
      await new Promise(resolve => setTimeout(resolve, 100))

      const decoded = await tokenService.verifyToken(token)

      expect(decoded).toBeNull()
    })

    it('debe rechazar token con firma inválida', async () => {
      const token = jwt.sign(
        { id: 'user123', type: 'access' },
        'wrong-secret-key',
        { expiresIn: '15m' }
      )

      mockRedisService.exists.mockResolvedValue(false)

      const decoded = await tokenService.verifyToken(token)

      expect(decoded).toBeNull()
    })
  })

  describe('refreshAccessToken', () => {
    it('debe renovar access token con refresh token válido', async () => {
      const userId = 'user123'
      const refreshToken = tokenService.generateRefreshToken(userId)

      mockRedisService.exists.mockResolvedValue(false)

      const result = await tokenService.refreshAccessToken(refreshToken)

      expect(result).toBeDefined()
      expect(result).toHaveProperty('accessToken')
      expect(typeof result.accessToken).toBe('string')

      const decoded = jwt.decode(result.accessToken)
      expect(decoded.id).toBe(userId)
      expect(decoded.type).toBe('access')
    })

    it('debe rechazar token con tipo incorrecto', async () => {
      const userId = 'user123'
      const accessToken = tokenService.generateAccessToken(userId) // Usar access en lugar de refresh

      mockRedisService.exists.mockResolvedValue(false)

      const result = await tokenService.refreshAccessToken(accessToken)

      expect(result).toBeNull()
    })

    it('debe rechazar refresh token inválido', async () => {
      const invalidToken = 'invalid.token.here'

      const result = await tokenService.refreshAccessToken(invalidToken)

      expect(result).toBeNull()
    })
  })

  describe('blacklistToken', () => {
    it('debe agregar token a la blacklist', async () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      mockRedisService.set.mockResolvedValue(undefined)

      await tokenService.blacklistToken(token, 900) // 15 minutos

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:'),
        '1',
        900
      )
    })

    it('debe calcular TTL automáticamente del token', async () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      mockRedisService.set.mockResolvedValue(undefined)

      await tokenService.blacklistToken(token) // Sin TTL explícito

      expect(mockRedisService.set).toHaveBeenCalled()
    })

    it('no debe agregar token expirado a blacklist', async () => {
      const token = jwt.sign(
        { id: 'user123', type: 'access' },
        'test-secret-key',
        { expiresIn: '-1h' } // Ya expirado
      )

      mockRedisService.set.mockResolvedValue(undefined)

      await tokenService.blacklistToken(token)

      expect(mockRedisService.set).not.toHaveBeenCalled()
    })
  })

  describe('isTokenBlacklisted', () => {
    it('debe detectar token en blacklist', async () => {
      const token = 'some.token.here'

      mockRedisService.exists.mockResolvedValue(true)

      const isBlacklisted = await tokenService.isTokenBlacklisted(token)

      expect(isBlacklisted).toBe(true)
      expect(mockRedisService.exists).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:')
      )
    })

    it('debe devolver false para token no en blacklist', async () => {
      const token = 'some.token.here'

      mockRedisService.exists.mockResolvedValue(false)

      const isBlacklisted = await tokenService.isTokenBlacklisted(token)

      expect(isBlacklisted).toBe(false)
    })

    it('debe devolver false en caso de error (fail-open)', async () => {
      const token = 'some.token.here'

      mockRedisService.exists.mockRejectedValue(new Error('Redis error'))

      const isBlacklisted = await tokenService.isTokenBlacklisted(token)

      expect(isBlacklisted).toBe(false)
    })
  })

  describe('blacklistAllUserTokens', () => {
    it('debe invalidar todos los tokens de un usuario', async () => {
      const userId = 'user123'

      mockRedisService.set.mockResolvedValue(undefined)

      await tokenService.blacklistAllUserTokens(userId)

      expect(mockRedisService.set).toHaveBeenCalledWith(
        `user:${userId}:tokens_invalidated`,
        expect.any(String),
        30 * 24 * 60 * 60 // 30 días
      )
    })
  })

  describe('areUserTokensInvalidated', () => {
    it('debe detectar tokens invalidados después del timestamp', async () => {
      const userId = 'user123'
      const tokenIssuedAt = Math.floor(Date.now() / 1000) - 3600 // Hace 1 hora
      const invalidatedAt = Date.now() - 1800 * 1000 // Hace 30 minutos

      mockRedisService.get.mockResolvedValue(invalidatedAt.toString())

      const areInvalidated = await tokenService.areUserTokensInvalidated(
        userId,
        tokenIssuedAt
      )

      expect(areInvalidated).toBe(true)
    })

    it('debe permitir tokens emitidos después de la invalidación', async () => {
      const userId = 'user123'
      const tokenIssuedAt = Math.floor(Date.now() / 1000) // Ahora
      const invalidatedAt = Date.now() - 3600 * 1000 // Hace 1 hora

      mockRedisService.get.mockResolvedValue(invalidatedAt.toString())

      const areInvalidated = await tokenService.areUserTokensInvalidated(
        userId,
        tokenIssuedAt
      )

      expect(areInvalidated).toBe(false)
    })

    it('debe devolver false si no hay invalidación', async () => {
      const userId = 'user123'
      const tokenIssuedAt = Math.floor(Date.now() / 1000)

      mockRedisService.get.mockResolvedValue(null)

      const areInvalidated = await tokenService.areUserTokensInvalidated(
        userId,
        tokenIssuedAt
      )

      expect(areInvalidated).toBe(false)
    })
  })

  describe('decodeToken', () => {
    it('debe decodificar token sin verificar', () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      const decoded = tokenService.decodeToken(token)

      expect(decoded).toBeDefined()
      expect(decoded.id).toBe(userId)
      expect(decoded.type).toBe('access')
    })

    it('debe devolver null para token inválido', () => {
      const invalidToken = 'invalid.token'

      const decoded = tokenService.decodeToken(invalidToken)

      expect(decoded).toBeNull()
    })
  })

  describe('getTokenTimeRemaining', () => {
    it('debe calcular tiempo restante de token', () => {
      const userId = 'user123'
      const token = tokenService.generateAccessToken(userId)

      const timeRemaining = tokenService.getTokenTimeRemaining(token)

      expect(timeRemaining).toBeGreaterThan(0)
      expect(timeRemaining).toBeLessThanOrEqual(15 * 60) // 15 minutos
    })

    it('debe devolver 0 para token expirado', () => {
      const token = jwt.sign(
        { id: 'user123', type: 'access' },
        'test-secret-key',
        { expiresIn: '0s' }
      )

      // Esperar un momento
      const timeRemaining = tokenService.getTokenTimeRemaining(token)

      expect(timeRemaining).toBe(0)
    })

    it('debe devolver null para token inválido', () => {
      const invalidToken = 'invalid.token'

      const timeRemaining = tokenService.getTokenTimeRemaining(invalidToken)

      expect(timeRemaining).toBeNull()
    })
  })
})

