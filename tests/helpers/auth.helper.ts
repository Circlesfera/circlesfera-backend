import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import type { UserDomain } from '../../src/modules/users/models/user.model.js';
import { env } from '../../src/config/index.js';

/**
 * Crea un token JWT de acceso válido para un usuario
 */
export function createAccessToken(userId: string): string {
  return jwt.sign(
    { type: 'access' },
    env.JWT_ACCESS_TOKEN_SECRET,
    {
      expiresIn: '1h',
      subject: userId
    }
  );
}

/**
 * Crea headers de autorización para tests de integración
 */
export function createAuthHeaders(userId: string): Record<string, string> {
  const token = createAccessToken(userId);
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Mock de request con usuario autenticado para tests
 */
export function createAuthenticatedRequest(userId: string, user?: Partial<UserDomain>): Partial<Request> {
  return {
    userId,
    user: user || { id: userId } as UserDomain,
    headers: {
      authorization: `Bearer ${createAccessToken(userId)}`
    }
  } as Partial<Request>;
}

/**
 * Crea un token JWT expirado para tests de manejo de errores
 */
export function createExpiredToken(userId: string): string {
  return jwt.sign(
    { type: 'access' },
    env.JWT_ACCESS_TOKEN_SECRET,
    {
      expiresIn: '-1h', // Token expirado
      subject: userId
    }
  );
}

/**
 * Crea un token JWT inválido para tests de manejo de errores
 */
export function createInvalidToken(): string {
  return 'invalid.token.string';
}

