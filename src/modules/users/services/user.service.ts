import { ApplicationError } from '@core/errors/application-error.js';

import { MongoUserRepository, type UserRepository } from '../repositories/user.repository.js';
import type { UpdateProfilePayload } from '../dtos/update-profile.dto.js';
import type { User } from '../models/user.model.js';

const userRepository: UserRepository = new MongoUserRepository();

export type PublicProfile = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
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

  private toPublicProfile(user: User): PublicProfile {
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

