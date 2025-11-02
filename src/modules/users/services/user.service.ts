import { hash, verify } from 'argon2';

import { ApplicationError } from '@core/errors/application-error.js';

import { MongoUserRepository, type UserRepository } from '../repositories/user.repository.js';
import type { UpdateProfilePayload } from '../dtos/update-profile.dto.js';
import type { User } from '../models/user.model.js';
import { MongoFollowRepository, type FollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import { MongoPostRepository, type PostRepository } from '@modules/feed/repositories/post.repository.js';

const userRepository: UserRepository = new MongoUserRepository();
const followRepository: FollowRepository = new MongoFollowRepository();
const postRepository: PostRepository = new MongoPostRepository();

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
    const updates = {
      displayName: payload.displayName,
      bio: payload.bio ?? null,
      avatarUrl: payload.avatarUrl ?? null
    } satisfies Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>;

    const updated = await userRepository.updateById(userId, updates);
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

