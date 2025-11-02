import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { CollectionModel, Collection } from '../models/collection.model.js';

export interface CollectionEntity {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  postCount: number;
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionRepository {
  create(userId: string, name: string, description?: string): Promise<CollectionEntity>;
  findById(collectionId: string): Promise<CollectionEntity | null>;
  findByUserId(userId: string): Promise<CollectionEntity[]>;
  update(collectionId: string, updates: { name?: string; description?: string }): Promise<CollectionEntity>;
  delete(collectionId: string): Promise<void>;
  incrementPostCount(collectionId: string): Promise<void>;
  decrementPostCount(collectionId: string): Promise<void>;
  updateCoverImage(collectionId: string, coverImageUrl: string): Promise<void>;
}

const toDomainCollection = (doc: DocumentType<Collection>): CollectionEntity => {
  const plain = doc.toObject<Collection & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    userId: plain.userId.toString(),
    name: plain.name,
    description: plain.description,
    isDefault: plain.isDefault,
    postCount: plain.postCount,
    coverImageUrl: plain.coverImageUrl,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoCollectionRepository implements CollectionRepository {
  public async create(userId: string, name: string, description?: string): Promise<CollectionEntity> {
    const collection = await CollectionModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      name,
      description,
      isDefault: false
    });

    return toDomainCollection(collection);
  }

  public async findById(collectionId: string): Promise<CollectionEntity | null> {
    const collection = await CollectionModel.findById(collectionId).exec();

    if (!collection) {
      return null;
    }

    return toDomainCollection(collection);
  }

  public async findByUserId(userId: string): Promise<CollectionEntity[]> {
    const collections = await CollectionModel.find({
      userId: new mongoose.Types.ObjectId(userId)
    })
      .sort({ createdAt: -1 })
      .exec();

    return collections.map((collection) => toDomainCollection(collection));
  }

  public async update(collectionId: string, updates: { name?: string; description?: string }): Promise<CollectionEntity> {
    const updateData: Partial<Collection> = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    const collection = await CollectionModel.findByIdAndUpdate(collectionId, { $set: updateData }, { new: true }).exec();

    if (!collection) {
      throw new Error('Colección no encontrada');
    }

    return toDomainCollection(collection);
  }

  public async delete(collectionId: string): Promise<void> {
    await CollectionModel.findByIdAndDelete(collectionId).exec();
  }

  public async incrementPostCount(collectionId: string): Promise<void> {
    await CollectionModel.findByIdAndUpdate(collectionId, { $inc: { postCount: 1 } }).exec();
  }

  public async decrementPostCount(collectionId: string): Promise<void> {
    await CollectionModel.findByIdAndUpdate(collectionId, { $inc: { postCount: -1 } }).exec();
  }

  public async updateCoverImage(collectionId: string, coverImageUrl: string): Promise<void> {
    await CollectionModel.findByIdAndUpdate(collectionId, { $set: { coverImageUrl } }).exec();
  }
}

