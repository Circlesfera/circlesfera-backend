import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { UserModel, User } from '../models/user.model.js';

export interface CreateUserInput {
  email: string;
  handle: string;
  displayName: string;
  passwordHash: string;
}

export interface SearchUsersOptions {
  query: string;
  limit?: number;
}

export interface UserRepository {
  create(data: CreateUserInput): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findByHandle(handle: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findManyByIds(ids: readonly string[]): Promise<User[]>;
  findManyByHandles(handles: readonly string[]): Promise<User[]>;
  searchUsers(options: SearchUsersOptions): Promise<User[]>;
  updateById(
    id: string,
    updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>
  ): Promise<User | null>;
  update(id: string, updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'isVerified'>>): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}

const toDomainUser = (doc: DocumentType<User>): User => {
  const plain = doc.toObject({ getters: true });
  const { passwordHash, _id, ...rest } = plain as typeof plain & { passwordHash?: string; _id: unknown };
  return {
    ...(rest as Omit<User, 'id' | 'passwordHash'>),
    id: doc._id.toString(),
    passwordHash: passwordHash ?? doc.passwordHash,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoUserRepository implements UserRepository {
  public async create(data: CreateUserInput): Promise<User> {
    const user = await UserModel.create({
      email: data.email,
      handle: data.handle,
      displayName: data.displayName,
      passwordHash: data.passwordHash
    });

    return toDomainUser(user);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
    return user ? toDomainUser(user) : null;
  }

  public async findByHandle(handle: string): Promise<User | null> {
    const user = await UserModel.findOne({ handle: handle.toLowerCase() }).select('+passwordHash').exec();
    return user ? toDomainUser(user) : null;
  }

  public async findById(id: string): Promise<User | null> {
    const user = await UserModel.findById(id).exec();
    return user ? toDomainUser(user) : null;
  }

  public async findManyByIds(ids: readonly string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const users = await UserModel.find({ _id: { $in: objectIds } }).exec();
    return users.map((user) => toDomainUser(user));
  }

  public async findManyByHandles(handles: readonly string[]): Promise<User[]> {
    if (handles.length === 0) {
      return [];
    }

    // Normalizar handles a lowercase para búsqueda
    const normalizedHandles = handles.map((handle) => handle.toLowerCase());
    const users = await UserModel.find({ handle: { $in: normalizedHandles } }).exec();
    return users.map((user) => toDomainUser(user));
  }

  public async searchUsers({ query, limit = 20 }: SearchUsersOptions): Promise<User[]> {
    if (query.trim().length === 0) {
      return [];
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const users = await UserModel.find({
      $or: [{ handle: searchRegex }, { displayName: searchRegex }]
    })
      .limit(limit)
      .exec();

    return users.map((user) => toDomainUser(user));
  }

  public async updateById(id: string, updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl'>>): Promise<User | null> {
    const user = await UserModel.findByIdAndUpdate(
      id,
      {
        $set: updates
      },
      { new: true }
    ).exec();
    return user ? toDomainUser(user) : null;
  }

  public async update(id: string, updates: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'isVerified'>>): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $set: updates
    }).exec();
  }

  public async updatePassword(id: string, passwordHash: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $set: { passwordHash }
    }).exec();
  }

  public async deleteById(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id).exec();
  }
}

