import { hash, verify } from 'argon2';

import { ApplicationError } from '@core/errors/application-error.js';

import { MongoUserRepository, type UserRepository } from '../repositories/user.repository.js';
import type { UpdateProfilePayload } from '../dtos/update-profile.dto.js';
import type { User } from '../models/user.model.js';
import { MongoFollowRepository, type FollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import { MongoPostRepository, type PostRepository } from '@modules/feed/repositories/post.repository.js';
import {
  MongoPreferencesRepository,
  type PreferencesRepository,
  type UpdatePreferencesInput
} from '../repositories/preferences.repository.js';

const userRepository: UserRepository = new MongoUserRepository();
const followRepository: FollowRepository = new MongoFollowRepository();
const postRepository: PostRepository = new MongoPostRepository();
const preferencesRepository: PreferencesRepository = new MongoPreferencesRepository();

export type PublicProfile = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserStats = {
  posts: number;
  followers: number;
  following: number;
};

export class UserService {
  public async getPublicProfile(handle: string): Promise<PublicProfile> {
    const user = await userRepository.findByHandle(handle.toLowerCase());
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.toPublicProfile(user);
  }

  public async updateProfile(userId: string, payload: UpdateProfilePayload): Promise<PublicProfile> {
    // Si se está cambiando el handle, verificar que no esté en uso
    if (payload.handle) {
      const currentUser = await userRepository.findById(userId);
      if (!currentUser) {
        throw new ApplicationError('Usuario no encontrado', {
          statusCode: 404,
          code: 'USER_NOT_FOUND'
        });
      }

      // Solo validar si el handle es diferente al actual
      const normalizedHandle = payload.handle.toLowerCase();
      if (normalizedHandle !== currentUser.handle) {
        const existingUser = await userRepository.findByHandle(normalizedHandle);
        if (existingUser && existingUser.id !== userId) {
          throw new ApplicationError('Este nombre de usuario ya está en uso', {
            statusCode: 409,
            code: 'HANDLE_ALREADY_EXISTS'
          });
        }
      }
    }

    const updates = {
      displayName: payload.displayName,
      handle: payload.handle ? payload.handle.toLowerCase() : undefined,
      bio: payload.bio ?? null,
      avatarUrl: payload.avatarUrl ?? null
    } satisfies Partial<Pick<User, 'displayName' | 'handle' | 'bio' | 'avatarUrl'>>;

    // Filtrar valores undefined
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    ) as Partial<Pick<User, 'displayName' | 'handle' | 'bio' | 'avatarUrl'>>;

    const updated = await userRepository.updateById(userId, cleanUpdates);
    if (!updated) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.toPublicProfile(updated);
  }

  public async searchUsers(query: string, limit = 20): Promise<PublicProfile[]> {
    const users = await userRepository.searchUsers({ query, limit });
    return users.map((user) => this.toPublicProfile(user));
  }

  public async getUserStats(userId: string): Promise<UserStats> {
    const [posts, followers, following] = await Promise.all([
      postRepository.countByAuthorId(userId),
      followRepository.countFollowers(userId),
      followRepository.countFollowing(userId)
    ]);

    return { posts, followers, following };
  }

  public async getUserPosts(userId: string, limit = 20, cursor?: Date) {
    return await postRepository.findByAuthorId({ authorId: userId, limit, cursor });
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    const userWithPassword = await userRepository.findByEmail(user.email);
    if (!userWithPassword || !userWithPassword.passwordHash) {
      throw new ApplicationError('Error al verificar la contraseña', {
        statusCode: 500,
        code: 'INTERNAL_ERROR'
      });
    }

    const isValidPassword = await verify(userWithPassword.passwordHash, currentPassword);
    if (!isValidPassword) {
      throw new ApplicationError('Contraseña actual incorrecta', {
        statusCode: 401,
        code: 'INVALID_PASSWORD'
      });
    }

    const newPasswordHash = await hash(newPassword);
    await userRepository.updatePassword(userId, newPasswordHash);
  }

  public async deleteAccount(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    await userRepository.deleteById(userId);
  }

  public async getPreferences(userId: string) {
    let preferences = await preferencesRepository.findByUserId(userId);
    if (!preferences) {
      preferences = await preferencesRepository.create(userId);
    }
    return preferences;
  }

  public async updatePreferences(userId: string, payload: UpdatePreferencesInput) {
    let preferences = await preferencesRepository.findByUserId(userId);
    if (!preferences) {
      preferences = await preferencesRepository.create(userId);
    }

    const updated = await preferencesRepository.update(userId, payload);
    if (!updated) {
      throw new ApplicationError('Error al actualizar preferencias', {
        statusCode: 500,
        code: 'INTERNAL_ERROR'
      });
    }

    return updated;
  }

  private toPublicProfile(user: User): PublicProfile {
    return {
      id: user.id,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      isVerified: (user as { isVerified?: boolean }).isVerified ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

