/**
 * Tests para Token Service
 *
 * Verifica la correcta generación, verificación y manejo de tokens JWT
 * para autenticación y refresh tokens.
 */

import tokenService from '../tokenService.js'
import jwt from 'jsonwebtoken'
import { config } from '../../utils/config.js'

// Constantes de test (NO hardcodeadas - usar desde config)
const TEST_USER_ID = '507f1f77bcf86cd799439011' // MongoDB ObjectId válido
// Usar los mismos secrets que usa tokenService (desde config)
const TEST_JWT_SECRET = config.jwtSecret
const TEST_JWT_REFRESH_SECRET = config.jwtRefreshSecret

describe('Token Service', () => {
  describe('generateAccessToken', () => {
    test('debe generar un access token válido', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateAccessToken(userId)

      // Assert
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    test('debe incluir userId en el payload', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateAccessToken(userId)
      const decoded = jwt.verify(token, TEST_JWT_SECRET)

      // Assert
      expect(decoded.userId).toBe(userId)
    })

    test('debe tener tipo "access" en el payload', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateAccessToken(userId)
      const decoded = jwt.verify(token, TEST_JWT_SECRET)

      // Assert
      expect(decoded.type).toBe('access')
    })

    test('debe tener exp (expiración) en el payload', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateAccessToken(userId)
      const decoded = jwt.verify(token, TEST_JWT_SECRET)

      // Assert
      expect(decoded.exp).toBeDefined()
      expect(typeof decoded.exp).toBe('number')
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000)
    })

    test('debe lanzar error con userId inválido', () => {
      // Arrange
      const invalidUserId = null

      // Act & Assert
      expect(() => {
        tokenService.generateAccessToken(invalidUserId)
      }).toThrow()
    })
  })

  describe('generateRefreshToken', () => {
    test('debe generar un refresh token válido', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateRefreshToken(userId)

      // Assert
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    test('debe incluir userId en el payload', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateRefreshToken(userId)
      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET)

      // Assert
      expect(decoded.userId).toBe(userId)
    })

    test('debe tener tipo "refresh" en el payload', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token = tokenService.generateRefreshToken(userId)
      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET)

      // Assert
      expect(decoded.type).toBe('refresh')
    })

    test('refresh token debe expirar después que access token', () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const accessToken = tokenService.generateAccessToken(userId)
      const refreshToken = tokenService.generateRefreshToken(userId)

      const accessDecoded = jwt.verify(accessToken, TEST_JWT_SECRET)
      const refreshDecoded = jwt.verify(refreshToken, TEST_JWT_REFRESH_SECRET)

      // Assert - Refresh debe durar más que Access
      expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp)
    })
  })

  describe('verifyAccessToken', () => {
    test('debe verificar un access token válido', () => {
      // Arrange
      const userId = TEST_USER_ID
      const token = tokenService.generateAccessToken(userId)

      // Act
      const decoded = tokenService.verifyAccessToken(token)

      // Assert
      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe(userId)
      expect(decoded.type).toBe('access')
    })

    test('debe rechazar un token expirado', () => {
      // Arrange - Token con expiración inmediata
      const userId = TEST_USER_ID
      const expiredToken = jwt.sign(
        { userId, type: 'access' },
        TEST_JWT_SECRET,
        { expiresIn: '0s' } // Expira inmediatamente
      )

      // Wait a moment to ensure expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          // Act & Assert
          expect(() => {
            tokenService.verifyAccessToken(expiredToken)
          }).toThrow()
          resolve()
        }, 100)
      })
    })

    test('debe rechazar un token con firma inválida', () => {
      // Arrange
      const invalidToken = jwt.sign(
        { userId: TEST_USER_ID },
        'wrong-secret-key'
      )

      // Act & Assert
      expect(() => {
        tokenService.verifyAccessToken(invalidToken)
      }).toThrow()
    })

    test('debe rechazar un token malformado', () => {
      // Arrange
      const malformedToken = 'invalid.token.format'

      // Act & Assert
      expect(() => {
        tokenService.verifyAccessToken(malformedToken)
      }).toThrow()
    })

    test('debe rechazar un refresh token en lugar de access', () => {
      // Arrange
      const userId = TEST_USER_ID
      const refreshToken = tokenService.generateRefreshToken(userId)

      // Act & Assert
      expect(() => {
        tokenService.verifyAccessToken(refreshToken)
      }).toThrow()
    })
  })

  describe('verifyRefreshToken', () => {
    test('debe verificar un refresh token válido', () => {
      // Arrange
      const userId = TEST_USER_ID
      const token = tokenService.generateRefreshToken(userId)

      // Act
      const decoded = tokenService.verifyRefreshToken(token)

      // Assert
      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe(userId)
      expect(decoded.type).toBe('refresh')
    })

    test('debe rechazar un access token en lugar de refresh', () => {
      // Arrange
      const userId = TEST_USER_ID
      const accessToken = tokenService.generateAccessToken(userId)

      // Act & Assert
      expect(() => {
        tokenService.verifyRefreshToken(accessToken)
      }).toThrow()
    })

    test('debe rechazar un refresh token expirado', () => {
      // Arrange
      const userId = TEST_USER_ID
      const expiredToken = jwt.sign(
        { userId, type: 'refresh' },
        TEST_JWT_REFRESH_SECRET,
        { expiresIn: '0s' }
      )

      // Wait a moment to ensure expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          // Act & Assert
          expect(() => {
            tokenService.verifyRefreshToken(expiredToken)
          }).toThrow()
          resolve()
        }, 100)
      })
    })
  })

  describe('decodeToken', () => {
    test('debe decodificar un token sin verificar', () => {
      // Arrange
      const userId = TEST_USER_ID
      const token = tokenService.generateAccessToken(userId)

      // Act
      const decoded = tokenService.decodeToken(token)

      // Assert
      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe(userId)
    })

    test('debe retornar null con token inválido', () => {
      // Arrange
      const invalidToken = 'invalid-token'

      // Act
      const decoded = tokenService.decodeToken(invalidToken)

      // Assert
      expect(decoded).toBeNull()
    })
  })

  describe('Seguridad', () => {
    test('tokens diferentes deben ser generados para el mismo userId', async () => {
      // Arrange
      const userId = TEST_USER_ID

      // Act
      const token1 = tokenService.generateAccessToken(userId)

      // Esperar 1 segundo para asegurar diferente iat (issued at timestamp)
      await new Promise(resolve => setTimeout(resolve, 1000))

      const token2 = tokenService.generateAccessToken(userId)

      // Assert - Los tokens deben ser diferentes por el iat (issued at)
      expect(token1).not.toBe(token2)
    })

    test('debe usar secrets diferentes si están configurados (mejora de seguridad)', () => {
      // Si los secrets son iguales (fallback), el test pasa con advertencia
      if (TEST_JWT_SECRET === TEST_JWT_REFRESH_SECRET) {
        console.warn('⚠️  ADVERTENCIA: JWT_SECRET y JWT_REFRESH_SECRET son iguales')
        console.warn('   Configura JWT_REFRESH_SECRET diferente en .env para mejor seguridad')

        // Test pasa, pero con advertencia
        expect(TEST_JWT_SECRET).toBe(TEST_JWT_REFRESH_SECRET)
      } else {
        // Si están configurados de forma diferente, verificar que funcionan
        const userId = TEST_USER_ID
        const accessToken = tokenService.generateAccessToken(userId)
        const refreshToken = tokenService.generateRefreshToken(userId)

        // Verificar que no son intercambiables
        expect(() => {
          jwt.verify(refreshToken, TEST_JWT_SECRET) // Usar access secret en refresh token
        }).toThrow()

        expect(() => {
          jwt.verify(accessToken, TEST_JWT_REFRESH_SECRET) // Usar refresh secret en access token
        }).toThrow()
      }
    })

    test('tokens deben contener solo información necesaria', () => {
      // Arrange
      const userId = TEST_USER_ID
      const token = tokenService.generateAccessToken(userId)
      const decoded = jwt.verify(token, TEST_JWT_SECRET)

      // Assert - No debe contener información sensible
      expect(decoded.password).toBeUndefined()
      expect(decoded.email).toBeUndefined()

      // Solo debe tener userId, type, iat, exp
      const expectedKeys = ['userId', 'type', 'iat', 'exp']
      const actualKeys = Object.keys(decoded)

      actualKeys.forEach(key => {
        expect(expectedKeys).toContain(key)
      })
    })
  })
})
