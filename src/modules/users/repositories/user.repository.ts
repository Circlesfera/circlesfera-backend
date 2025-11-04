import type { UserDomain, UserDocument } from '../models/user.model.js';
import { UserModel } from '../models/user.model.js';

export interface CreateUserInput {
  email: string;
  handle: string;
  displayName: string;
  passwordHash: string;
}

export interface SearchUsersOptions {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateUserInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  handle?: string;
  isVerified?: boolean;
}

export interface UserRepository {
  create(data: CreateUserInput): Promise<UserDomain>;
  findByEmail(email: string): Promise<UserDomain | null>;
  findByHandle(handle: string): Promise<UserDomain | null>;
  findById(id: string): Promise<UserDomain | null>;
  findManyByIds(ids: string[]): Promise<UserDomain[]>;
  findManyByHandles(handles: readonly string[]): Promise<UserDomain[]>;
  searchUsers(options: SearchUsersOptions): Promise<UserDomain[]>;
  updateById(
    id: string,
    updates: Partial<Pick<UserDomain, 'displayName' | 'bio' | 'avatarUrl' | 'handle'>>
  ): Promise<UserDomain | null>;
  update(userId: string, updates: UpdateUserInput): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  deleteById(userId: string): Promise<void>;
}

const toDomainUser = (doc: UserDocument): UserDomain => {
  return {
    id: doc._id.toString(),
    email: doc.email,
    handle: doc.handle,
    displayName: doc.displayName,
    passwordHash: doc.passwordHash,
    bio: doc.bio ?? null,
    avatarUrl: doc.avatarUrl ?? null,
    isVerified: doc.isVerified ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
};

export class MongoUserRepository implements UserRepository {
  public async create(data: CreateUserInput): Promise<UserDomain> {
    const user = await UserModel.create({
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      passwordHash: data.passwordHash
    });

    return toDomainUser(user);
  }

  public async findByEmail(email: string): Promise<UserDomain | null> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
    return user ? toDomainUser(user) : null;
  }

  public async findByHandle(handle: string): Promise<UserDomain | null> {
    const user = await UserModel.findOne({ handle: handle.toLowerCase() }).exec();
    return user ? toDomainUser(user) : null;
  }

  public async findById(id: string): Promise<UserDomain | null> {
    const user = await UserModel.findById(id).exec();
    return user ? toDomainUser(user) : null;
  }

  public async findManyByIds(ids: string[]): Promise<UserDomain[]> {
    if (ids.length === 0) {
      return [];
    }

    const users = await UserModel.find({ _id: { $in: ids } }).exec();
    return users.map((user) => toDomainUser(user));
  }

  public async updateById(id: string, updates: Partial<Pick<UserDomain, 'displayName' | 'bio' | 'avatarUrl' | 'handle'>>): Promise<UserDomain | null> {
    // Si se actualiza el handle, normalizarlo a lowercase
    if (updates.handle) {
      updates.handle = updates.handle.toLowerCase();
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      {
        $set: updates
      },
      { new: true }
    ).exec();
    return user ? toDomainUser(user) : null;
  }

  public async findManyByHandles(handles: readonly string[]): Promise<UserDomain[]> {
    if (handles.length === 0) {
      return [];
    }

    const normalizedHandles = handles.map((h) => h.toLowerCase());
    const users = await UserModel.find({ handle: { $in: normalizedHandles } }).exec();
    return users.map((user) => toDomainUser(user));
  }

  public async searchUsers(options: SearchUsersOptions): Promise<UserDomain[]> {
    const { query = '', limit = 20, offset = 0 } = options;
    const searchQuery: Record<string, unknown> = {};

    if (query.trim()) {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchQuery.$or = [
        { handle: searchRegex },
        { displayName: searchRegex }
      ];
    }

    const users = await UserModel.find(searchQuery)
      .limit(limit)
      .skip(offset)
      .exec();

    return users.map((user) => toDomainUser(user));
  }

  public async update(userId: string, updates: UpdateUserInput): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { $set: updates }).exec();
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { $set: { passwordHash } }).exec();
  }

  public async deleteById(userId: string): Promise<void> {
    await UserModel.findByIdAndDelete(userId).exec();
  }
}
