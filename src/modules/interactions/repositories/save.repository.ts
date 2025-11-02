import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { SaveModel, Save } from '../models/save.model.js';

export interface SaveEntity {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveRepository {
  create(postId: string, userId: string): Promise<SaveEntity>;
  delete(postId: string, userId: string): Promise<void>;
  exists(postId: string, userId: string): Promise<boolean>;
  findSavedPostIds(userId: string, postIds: string[]): Promise<string[]>;
  findByUserId(userId: string, limit?: number, cursor?: Date): Promise<{ items: SaveEntity[]; hasMore: boolean }>;
}

const toDomainSave = (doc: DocumentType<Save>): SaveEntity => {
  const plain = doc.toObject<Save & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    postId: plain.postId.toString(),
    userId: plain.userId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoSaveRepository implements SaveRepository {
  public async create(postId: string, userId: string): Promise<SaveEntity> {
    const save = await SaveModel.create({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    });

    return toDomainSave(save);
  }

  public async delete(postId: string, userId: string): Promise<void> {
    await SaveModel.deleteOne({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }

  public async exists(postId: string, userId: string): Promise<boolean> {
    const count = await SaveModel.countDocuments({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();

    return count > 0;
  }

  public async findSavedPostIds(userId: string, postIds: string[]): Promise<string[]> {
    if (postIds.length === 0) {
      return [];
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    const saves = await SaveModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      postId: { $in: objectIds }
    })
      .select('postId')
      .exec();

    return saves.map((save) => save.postId.toString());
  }

  public async findByUserId(userId: string, limit = 20, cursor?: Date): Promise<{ items: SaveEntity[]; hasMore: boolean }> {
    const query: mongoose.FilterQuery<Save> = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await SaveModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainSave(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }
}

