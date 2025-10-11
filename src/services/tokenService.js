/**
 * Servicio para manejo de tokens JWT (Access + Refresh)
 * Implementa blacklist en Redis para logout y seguridad
 */

import jwt from 'jsonwebtoken'
import { config } from '../utils/config.js'
import redisService from './redisService.js'
import logger from '../utils/logger.js'

class TokenService {
  /**
   * Generar Access Token (corta duración)
   * @param {string} userId - ID del usuario
   * @returns {string} Access token
   */
  generateAccessToken(userId) {
    return jwt.sign(
      { id: userId, type: 'access' },
      config.jwtSecret,
      { expiresIn: config.jwtAccessExpiresIn }
    )
  }

  /**
   * Generar Refresh Token (larga duración)
   * @param {string} userId - ID del usuario
   * @returns {string} Refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      { id: userId, type: 'refresh' },
      config.jwtSecret,
      { expiresIn: config.jwtRefreshExpiresIn }
    )
  }

  /**
   * Generar par de tokens (access + refresh)
   * @param {string} userId - ID del usuario
   * @returns {{accessToken: string, refreshToken: string}}
   */
  generateTokenPair(userId) {
    return {
      accessToken: this.generateAccessToken(userId),
      refreshToken: this.generateRefreshToken(userId)
    }
  }

  /**
   * Verificar token JWT
   * @param {string} token - Token a verificar
   * @returns {Promise<object|null>} Payload del token o null si es inválido
   */
  async verifyToken(token) {
    try {
      // Verificar que el token no esté en la blacklist
      const isBlacklisted = await this.isTokenBlacklisted(token)
      if (isBlacklisted) {
        logger.warn('Intento de usar token en blacklist')
        return null
      }

      // Verificar firma y expiración
      const decoded = jwt.verify(token, config.jwtSecret)
      return decoded
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logger.debug('Token expirado')
      } else if (error.name === 'JsonWebTokenError') {
        logger.warn('Token inválido:', error.message)
      } else {
        logger.error('Error al verificar token:', error)
      }
      return null
    }
  }

  /**
   * Renovar access token usando refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string}|null>} Nuevo access token o null si falla
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = await this.verifyToken(refreshToken)

      if (!decoded || decoded.type !== 'refresh') {
        logger.warn('Refresh token inválido o tipo incorrecto')
        return null
      }

      // Generar nuevo access token
      const accessToken = this.generateAccessToken(decoded.id)

      return { accessToken }
    } catch (error) {
      logger.error('Error al renovar access token:', error)
      return null
    }
  }

  /**
   * Agregar token a la blacklist (logout, cambio de contraseña, etc.)
   * @param {string} token - Token a invalidar
   * @param {number} expiresIn - Tiempo de expiración en segundos
   */
  async blacklistToken(token, expiresIn = null) {
    try {
      // Si no se proporciona expiresIn, calcular desde el token
      if (!expiresIn) {
        const decoded = jwt.decode(token)
        if (decoded && decoded.exp) {
          expiresIn = decoded.exp - Math.floor(Date.now() / 1000)
        }
      }

      // Solo guardar si aún no ha expirado
      if (expiresIn && expiresIn > 0) {
        const key = `blacklist:${token}`
        await redisService.set(key, '1', expiresIn)
        logger.info('Token agregado a blacklist')
      }
    } catch (error) {
      logger.error('Error al agregar token a blacklist:', error)
    }
  }

  /**
   * Verificar si un token está en la blacklist
   * @param {string} token - Token a verificar
   * @returns {Promise<boolean>}
   */
  async isTokenBlacklisted(token) {
    try {
      const key = `blacklist:${token}`
      return await redisService.exists(key)
    } catch (error) {
      logger.error('Error al verificar blacklist:', error)
      // En caso de error, permitir el acceso (fail-open para disponibilidad)
      return false
    }
  }

  /**
   * Invalidar todos los tokens de un usuario (cambio de contraseña, compromiso de cuenta)
   * @param {string} userId - ID del usuario
   */
  async blacklistAllUserTokens(userId) {
    try {
      // Marcar usuario como "tokens invalidados"
      const key = `user:${userId}:tokens_invalidated`
      const timestamp = Date.now()
      // Guardar por 30 días (máxima duración de refresh token)
      await redisService.set(key, timestamp.toString(), 30 * 24 * 60 * 60)
      logger.info(`Todos los tokens del usuario ${userId} invalidados`)
    } catch (error) {
      logger.error('Error al invalidar todos los tokens del usuario:', error)
    }
  }

  /**
   * Verificar si todos los tokens de un usuario fueron invalidados
   * @param {string} userId - ID del usuario
   * @param {number} tokenIssuedAt - Timestamp de emisión del token (iat)
   * @returns {Promise<boolean>}
   */
  async areUserTokensInvalidated(userId, tokenIssuedAt) {
    try {
      const key = `user:${userId}:tokens_invalidated`
      const invalidatedTimestamp = await redisService.get(key)

      if (!invalidatedTimestamp) { return false }

      // Si el token fue emitido antes de la invalidación, está invalidado
      return tokenIssuedAt < parseInt(invalidatedTimestamp)
    } catch (error) {
      logger.error('Error al verificar invalidación de tokens del usuario:', error)
      return false
    }
  }

  /**
   * Decodificar token sin verificar (útil para inspección)
   * @param {string} token - Token
   * @returns {object|null}
   */
  decodeToken(token) {
    try {
      return jwt.decode(token)
    } catch (error) {
      logger.error('Error al decodificar token:', error)
      return null
    }
  }

  /**
   * Calcular tiempo restante de un token en segundos
   * @param {string} token - Token
   * @returns {number|null} Segundos restantes o null si inválido/expirado
   */
  getTokenTimeRemaining(token) {
    try {
      const decoded = jwt.decode(token)
      if (!decoded || !decoded.exp) { return null }

      const now = Math.floor(Date.now() / 1000)
      const remaining = decoded.exp - now

      return remaining > 0 ? remaining : 0
    } catch (error) {
      logger.error('Error al calcular tiempo restante del token:', error)
      return null
    }
  }
}

// Singleton
const tokenService = new TokenService()

export default tokenService

