import { describe, it, expect, beforeEach } from '@jest/globals';

import { AuthService } from '@modules/auth/services/auth.service.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';

// Mock de repositorios
const mockUserRepository = {
  findByEmail: jest.fn(),
  findByHandle: jest.fn(),
  create: jest.fn(),
  findById: jest.fn()
} as unknown as UserRepository;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - Acceso privado para testing
    authService = new AuthService();
    // @ts-expect-error - Mock del repositorio
    authService['userRepository'] = mockUserRepository;
  });

  describe('register', () => {
    it('debe lanzar error si el email ya existe', async () => {
      const payload = {
        email: 'test@example.com',
        handle: 'testuser',
        displayName: 'Test User',
        password: 'password123'
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue({ id: '123', email: 'test@example.com' });

      await expect(authService.register(payload)).rejects.toThrow(ApplicationError);
      await expect(authService.register(payload)).rejects.toThrow('El correo electrónico ya está en uso');
    });

    it('debe lanzar error si el handle ya existe', async () => {
      const payload = {
        email: 'test@example.com',
        handle: 'testuser',
        displayName: 'Test User',
        password: 'password123'
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(null);
      mockUserRepository.findByHandle = jest.fn().mockResolvedValue({ id: '123', handle: 'testuser' });

      await expect(authService.register(payload)).rejects.toThrow(ApplicationError);
      await expect(authService.register(payload)).rejects.toThrow('El handle ya está en uso');
    });

    it('debe crear un usuario y retornar tokens si los datos son válidos', async () => {
      const payload = {
        email: 'test@example.com',
        handle: 'testuser',
        displayName: 'Test User',
        password: 'password123'
      };

      const mockUser = {
        id: '123',
        email: payload.email,
        handle: payload.handle.toLowerCase(),
        displayName: payload.displayName,
        passwordHash: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(null);
      mockUserRepository.findByHandle = jest.fn().mockResolvedValue(null);
      mockUserRepository.create = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.register(payload);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(payload.email);
      expect(result.user.handle).toBe(payload.handle.toLowerCase());
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('debe lanzar error si el usuario no existe', async () => {
      const payload = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(null);

      await expect(authService.login(payload)).rejects.toThrow(ApplicationError);
      await expect(authService.login(payload)).rejects.toThrow('Credenciales inválidas');
    });

    it('debe lanzar error si la contraseña es incorrecta', async () => {
      const payload = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const mockUser = {
        id: '123',
        email: payload.email,
        passwordHash: 'correct_hash',
        handle: 'testuser',
        displayName: 'Test User'
      };

      mockUserRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);

      // Mock de verify que retorna false
      const { verify } = await import('argon2');
      jest.spyOn(await import('argon2'), 'verify').mockResolvedValue(false);

      await expect(authService.login(payload)).rejects.toThrow(ApplicationError);
      await expect(authService.login(payload)).rejects.toThrow('Credenciales inválidas');
    });
  });
});

