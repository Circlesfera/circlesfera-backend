import { describe, expect, it, beforeEach, beforeAll, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { ApplicationError } from '@core/errors/application-error.js';
// import { AuthService } from '../services/auth.service.js'; // será importado dinámicamente tras los mocks
import type { RegisterPayload, LoginPayload } from '../dtos/index.js';
import type { UserDomain } from '../../users/models/user.model.js';
import type { UserRepository } from '../../users/repositories/user.repository.js';
import type { RefreshTokenService } from '../services/refresh-token.service.js';

// Mock de dependencias externas ANTES de importar el servicio
const mockHashFn = jest.fn() as jest.MockedFunction<(password: string) => Promise<string>>;
const mockVerifyFn = jest.fn() as jest.MockedFunction<(hash: string, password: string) => Promise<boolean>>;
const mockJwtSignFn = jest.fn() as jest.MockedFunction<(payload: object | string, secret: string, options?: any) => string | undefined>;
const mockJwtVerifyFn = jest.fn() as jest.MockedFunction<(token: string, secret: string, options?: any) => any>;

// Mockear @config/index también aquí porque usamos unstable_mockModule
let AuthService: any;

beforeAll(async () => {
  // Mock @config/index ANTES de otros módulos
  await jest.unstable_mockModule('@config/index', () => ({
    env: {
      JWT_ACCESS_TOKEN_SECRET: 'test-access-secret-min-16-characters',
      JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret-min-16-characters',
      JWT_ACCESS_TOKEN_TTL: 900,
      JWT_REFRESH_TOKEN_TTL: 604800,
      NODE_ENV: 'test' as const,
      PORT: 4000,
      API_URL: 'http://localhost:4000',
      CLIENT_APP_URL: 'http://localhost:3000',
      MONGO_URI: 'mongodb://localhost:27017/circlesfera-test',
      MONGO_DB_NAME: 'circlesfera-test',
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'test-key',
      S3_SECRET_KEY: 'test-secret',
      S3_BUCKET_MEDIA: 'test-bucket',
      COOKIE_DOMAIN: 'localhost',
      COOKIE_SECURE: false,
      FFMPEG_CONCURRENCY: 2
    }
  }));

  // Mock ESM con unstable_mockModule
  await jest.unstable_mockModule('argon2', () => ({
    hash: mockHashFn,
    verify: mockVerifyFn
  }));

  await jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
      sign: mockJwtSignFn,
      verify: mockJwtVerifyFn
    },
    sign: mockJwtSignFn,
    verify: mockJwtVerifyFn
  }));

  // Importar el servicio una vez que los módulos han sido mockeados
  const mod = await import('../services/auth.service.js');
  AuthService = mod.AuthService;
});

// Importar tipos para TS (no usados en runtime)
import type { hash as _hash, verify as _verify } from 'argon2';
import type jwt from 'jsonwebtoken';

// Alias de funciones mock
const mockHash = mockHashFn;
const mockVerify = mockVerifyFn;
const mockJwtSign = mockJwtSignFn;
const mockJwtVerify = mockJwtVerifyFn;

describe('AuthService', () => {
  let authService: any;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockRefreshTokenService: jest.Mocked<RefreshTokenService>;

  // Crear usuario de prueba
  const createMockUser = (overrides: Partial<UserDomain> = {}): UserDomain => ({
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? 'test@example.com',
    handle: overrides.handle ?? 'testuser',
    displayName: overrides.displayName ?? 'Test User',
    bio: overrides.bio ?? null,
    avatarUrl: overrides.avatarUrl ?? null,
    passwordHash: overrides.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$hashedPassword',
    createdAt: overrides.createdAt ?? new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2024-01-01T00:00:00.000Z')
  });

  beforeEach(() => {
    // Limpiar mocks
    jest.clearAllMocks();
    mockHashFn.mockReset();
    mockVerifyFn.mockReset();
    mockJwtSignFn.mockReset();
    mockJwtVerifyFn.mockReset();

    // Mock del repositorio de usuarios
    mockUserRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findByHandle: jest.fn(),
      findById: jest.fn(),
      findManyByIds: jest.fn(),
      findManyByHandles: jest.fn(),
      searchUsers: jest.fn(),
      updateById: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      deleteById: jest.fn()
    } as jest.Mocked<UserRepository>;

    // Mock del servicio de refresh token
    mockRefreshTokenService = {
      createSession: jest.fn(),
      validateSession: jest.fn(),
      revokeSession: jest.fn()
    } as jest.Mocked<RefreshTokenService>;

    // Instanciar el servicio con mocks
    authService = new AuthService(mockUserRepository, mockRefreshTokenService);
  });

  describe('register', () => {
    const validPayload: RegisterPayload = {
      email: 'newuser@example.com',
      handle: 'newuser',
      displayName: 'New User',
      password: 'SecurePass123'
    };

    it('registra un usuario correctamente', async () => {
      // Arrange
      const mockUser = createMockUser({
        email: validPayload.email,
        handle: validPayload.handle,
        displayName: validPayload.displayName
      });

      const hashedPassword = '$argon2id$hashed';
      const sessionId = randomUUID();
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByHandle.mockResolvedValue(null);
      mockHashFn.mockResolvedValue(hashedPassword);
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockRefreshTokenService.createSession.mockResolvedValue(sessionId);
      mockJwtSignFn.mockImplementation((payload: any, _secret: any, options: any) => {
        // ACCESS_TOKEN_EXPIRY viene de env.JWT_ACCESS_TOKEN_TTL que es 900
        if (options?.expiresIn === '900s') {
          return accessToken;
        }
        return refreshToken;
      });

      // Instanciar servicio
      const authService = new AuthService(mockUserRepository, mockRefreshTokenService);

      // Act
      const result = await authService.register(validPayload);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validPayload.email);
      expect(mockUserRepository.findByHandle).toHaveBeenCalledWith(validPayload.handle);
      expect(mockHashFn).toHaveBeenCalledWith(validPayload.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: validPayload.email,
        handle: validPayload.handle.toLowerCase(),
        displayName: validPayload.displayName,
        passwordHash: hashedPassword
      });
      expect(result.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        handle: mockUser.handle,
        displayName: mockUser.displayName
      });
      expect(result.tokens).toMatchObject({
        accessToken,
        refreshToken,
        expiresIn: 900 // JWT_ACCESS_TOKEN_TTL es 900
      });
    });

    it('lanza error cuando el email ya existe', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(createMockUser());

      // Act & Assert
      await expect(authService.register(validPayload)).rejects.toThrow(ApplicationError);
      await expect(authService.register(validPayload)).rejects.toMatchObject({
        message: 'El correo electrónico ya está en uso',
        statusCode: 409,
        code: 'EMAIL_ALREADY_EXISTS'
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalled();
      expect(mockUserRepository.findByHandle).not.toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('lanza error cuando el handle ya existe', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByHandle.mockResolvedValue(createMockUser());

      // Act & Assert
      await expect(authService.register(validPayload)).rejects.toThrow(ApplicationError);
      await expect(authService.register(validPayload)).rejects.toMatchObject({
        message: 'El handle ya está en uso',
        statusCode: 409,
        code: 'HANDLE_ALREADY_EXISTS'
      });

      expect(mockUserRepository.findByHandle).toHaveBeenCalled();
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('normaliza el handle a minúsculas', async () => {
      // Arrange
      const upperCaseHandle = 'NEWUSER';
      const payload: RegisterPayload = { ...validPayload, handle: upperCaseHandle };
      const mockUser = createMockUser({ handle: upperCaseHandle.toLowerCase() });
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByHandle.mockResolvedValue(null);
      mockHashFn.mockResolvedValue('hashed');
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockRefreshTokenService.createSession.mockResolvedValue(randomUUID());
      mockJwtSignFn.mockImplementation(() => 'token');

      // Act
      await authService.register(payload);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          handle: upperCaseHandle.toLowerCase()
        })
      );
    });
  });

  describe('login', () => {
    const validPayload: LoginPayload = {
      identifier: 'test@example.com',
      password: 'correctpassword'
    };

    it('inicia sesión correctamente con email', async () => {
      // Arrange
      const mockUser = createMockUser();
      const sessionId = randomUUID();
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockVerifyFn.mockResolvedValue(true);
      mockRefreshTokenService.createSession.mockResolvedValue(sessionId);
      mockJwtSignFn.mockImplementation((payload, secret, options: any) => {
        if (options?.expiresIn === '900s') {
          return accessToken;
        }
          return refreshToken;
      });

      // Act
      const result = await authService.login(validPayload);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validPayload.identifier.toLowerCase());
      expect(mockVerifyFn).toHaveBeenCalledWith(mockUser.passwordHash, validPayload.password);
      expect(result.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        handle: mockUser.handle
      });
      expect(result.tokens).toBeDefined();
    });

    it('inicia sesión correctamente con handle', async () => {
      // Arrange
      const payloadWithHandle: LoginPayload = {
        identifier: 'testuser',
        password: 'correctpassword'
      };
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByHandle.mockResolvedValue(mockUser);
      mockVerifyFn.mockResolvedValue(true);
      mockRefreshTokenService.createSession.mockResolvedValue(randomUUID());
      mockJwtSignFn.mockImplementation(() => 'token');

      // Act
      await authService.login(payloadWithHandle);

      // Assert
      expect(mockUserRepository.findByHandle).toHaveBeenCalledWith(payloadWithHandle.identifier.toLowerCase());
    });

    it('lanza error cuando el usuario no existe', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByHandle.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(validPayload)).rejects.toThrow(ApplicationError);
      await expect(authService.login(validPayload)).rejects.toMatchObject({
        message: 'Credenciales inválidas',
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });

      expect(mockVerifyFn).not.toHaveBeenCalled();
    });

    it('lanza error cuando la contraseña es incorrecta', async () => {
      // Arrange
      const mockUser = createMockUser();
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockVerifyFn.mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(validPayload)).rejects.toThrow(ApplicationError);
      await expect(authService.login(validPayload)).rejects.toMatchObject({
        message: 'Credenciales inválidas',
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });
  });

  describe('refresh', () => {
    const validRefreshToken = 'valid-refresh-token';
    const sessionId = randomUUID();
    const userId = randomUUID();

    it('renueva tokens correctamente', async () => {
      // Arrange
      const mockSession = {
        userId,
        createdAt: new Date().toISOString()
      };
      const accessToken = 'new-access-token';
      const refreshToken = 'new-refresh-token';

      mockJwtVerifyFn.mockReturnValue({
        type: 'refresh',
        sessionId,
        sub: userId
      } as any);

      mockRefreshTokenService.validateSession.mockResolvedValue(mockSession);
      mockRefreshTokenService.revokeSession.mockResolvedValue();
      mockRefreshTokenService.createSession.mockResolvedValue(randomUUID());
      mockJwtSignFn.mockImplementation((payload, secret, options: any) => {
        if (options?.expiresIn === '900s') {
          return accessToken;
        }
          return refreshToken;
      });

      // Act
      const result = await authService.refresh(validRefreshToken);

      // Assert
      expect(mockJwtVerifyFn).toHaveBeenCalledWith(
        validRefreshToken,
        'test-refresh-secret-min-16-characters',
        {}
      );
      expect(mockRefreshTokenService.validateSession).toHaveBeenCalledWith(sessionId);
      expect(mockRefreshTokenService.revokeSession).toHaveBeenCalledWith(sessionId);
      expect(result).toMatchObject({
        accessToken,
        refreshToken,
        expiresIn: 900
      });
    });

    it('lanza error cuando la sesión no existe', async () => {
      // Arrange
      mockJwtVerifyFn.mockReturnValue({
        type: 'refresh',
        sessionId,
        sub: userId
      } as any);

      mockRefreshTokenService.validateSession.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refresh(validRefreshToken)).rejects.toThrow(ApplicationError);
      await expect(authService.refresh(validRefreshToken)).rejects.toMatchObject({
        message: 'Sesión expirada o inexistente',
        statusCode: 401,
        code: 'SESSION_NOT_FOUND'
      });

      expect(mockRefreshTokenService.revokeSession).not.toHaveBeenCalled();
    });

    it('lanza error cuando el refresh token es inválido', async () => {
      // Arrange
      mockJwtVerifyFn.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.refresh('invalid-token')).rejects.toThrow(ApplicationError);
      await expect(authService.refresh('invalid-token')).rejects.toMatchObject({
        message: 'Refresh token inválido o expirado',
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN'
      });
    });
  });

  describe('logout', () => {
    const validRefreshToken = 'valid-refresh-token';
    const sessionId = randomUUID();
    const userId = randomUUID();

    it('cierra sesión correctamente', async () => {
      // Arrange
      mockJwtVerifyFn.mockReturnValue({
        type: 'refresh',
        sessionId,
        sub: userId
      } as any);

      mockRefreshTokenService.revokeSession.mockResolvedValue();

      // Act
      await authService.logout(validRefreshToken);

      // Assert
      expect(mockJwtVerifyFn).toHaveBeenCalledWith(
        validRefreshToken,
        'test-refresh-secret-min-16-characters',
        { ignoreExpiration: true }
      );
      expect(mockRefreshTokenService.revokeSession).toHaveBeenCalledWith(sessionId);
    });

    it('revoca la sesión incluso con token expirado', async () => {
      // Arrange
      mockJwtVerifyFn.mockReturnValue({
        type: 'refresh',
        sessionId,
        sub: userId
      } as any);

      mockRefreshTokenService.revokeSession.mockResolvedValue();

      // Act
      await authService.logout(validRefreshToken);

      // Assert
      expect(mockJwtVerifyFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { ignoreExpiration: true }
      );
    });
  });

  describe('getProfile', () => {
    const userId = randomUUID();

    it('obtiene el perfil del usuario correctamente', async () => {
      // Arrange
      const mockUser = createMockUser({ id: userId });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.getProfile(userId);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        handle: mockUser.handle,
        displayName: mockUser.displayName,
        bio: mockUser.bio,
        avatarUrl: mockUser.avatarUrl
      });
    });

    it('lanza error cuando el usuario no existe', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.getProfile(userId)).rejects.toThrow(ApplicationError);
      await expect(authService.getProfile(userId)).rejects.toMatchObject({
        message: 'Usuario no encontrado',
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    });
  });
});
