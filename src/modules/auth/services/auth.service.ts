import { hash, verify } from 'argon2';
import jwt from 'jsonwebtoken';

import { env } from '@config/index.js';
import { ApplicationError } from '@core/errors/application-error.js';

import type { RegisterPayload } from '../dtos/register.dto.js';
import type { LoginPayload } from '../dtos/login.dto.js';
import type { User } from '../../users/models/user.model.js';
import { MongoUserRepository, type UserRepository } from '../../users/repositories/user.repository.js';
import { RefreshTokenService } from './refresh-token.service.js';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface PublicUser {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

const userRepository: UserRepository = new MongoUserRepository();
const refreshTokenService = new RefreshTokenService();

const normalizeHandle = (handle: string): string => handle.toLowerCase();

const ACCESS_TOKEN_EXPIRY = env.JWT_ACCESS_TOKEN_TTL; // seconds

export class AuthService {
  public async register(payload: RegisterPayload): Promise<AuthResult> {
    const existingByEmail = await userRepository.findByEmail(payload.email);
    if (existingByEmail) {
      throw new ApplicationError('El correo electrónico ya está en uso', {
        statusCode: 409,
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }

    const existingByHandle = await userRepository.findByHandle(payload.handle);
    if (existingByHandle) {
      throw new ApplicationError('El handle ya está en uso', {
        statusCode: 409,
        code: 'HANDLE_ALREADY_EXISTS'
      });
    }

    const passwordHash = await hash(payload.password);
    const user = await userRepository.create({
      email: payload.email,
      handle: normalizeHandle(payload.handle),
      displayName: payload.displayName,
      passwordHash
    });

    const tokens = await this.issueTokens(user.id);

    return { user: this.toPublicUser(user), tokens };
  }

  public async login(payload: LoginPayload): Promise<AuthResult> {
    const identifier = payload.identifier.toLowerCase();
    const user = (await userRepository.findByEmail(identifier)) ?? (await userRepository.findByHandle(identifier));

    if (!user) {
      throw new ApplicationError('Credenciales inválidas', {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isPasswordValid = await verify(user.passwordHash, payload.password);
    if (!isPasswordValid) {
      throw new ApplicationError('Credenciales inválidas', {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    }

    const tokens = await this.issueTokens(user.id);

    return { user: this.toPublicUser(user), tokens };
  }

  public async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await refreshTokenService.validateSession(payload.sessionId);
    if (!session) {
      throw new ApplicationError('Sesión expirada o inexistente', {
        statusCode: 401,
        code: 'SESSION_NOT_FOUND'
      });
    }

    await refreshTokenService.revokeSession(payload.sessionId);
    return this.issueTokens(session.userId);
  }

  public async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken, { ignoreExpiration: true });
    await refreshTokenService.revokeSession(payload.sessionId);
  }

  public async getProfile(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.toPublicUser(user);
  }

  private async issueTokens(userId: string): Promise<AuthTokens> {
    const sessionId = await refreshTokenService.createSession(userId);

    const accessToken = jwt.sign({ type: 'access' }, env.JWT_ACCESS_TOKEN_SECRET, {
      expiresIn: `${ACCESS_TOKEN_EXPIRY}s`,
      subject: userId
    });

    const refreshToken = jwt.sign({ type: 'refresh', sessionId }, env.JWT_REFRESH_TOKEN_SECRET, {
      expiresIn: `${env.JWT_REFRESH_TOKEN_TTL}s`,
      subject: userId
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY
    };
  }

  private verifyRefreshToken(
    refreshToken: string,
    options?: jwt.VerifyOptions
  ): { sessionId: string; userId: string } {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_TOKEN_SECRET, options ?? {});
      if (typeof decoded !== 'object' || !('sessionId' in decoded) || typeof decoded.sessionId !== 'string') {
        throw new ApplicationError('Refresh token inválido', {
          statusCode: 401,
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      return {
        sessionId: decoded.sessionId,
        userId: typeof decoded.sub === 'string' ? decoded.sub : ''
      };
    } catch (error) {
      throw new ApplicationError('Refresh token inválido o expirado', {
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
        cause: error as Error
      });
    }
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

