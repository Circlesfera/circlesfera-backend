import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { SaveModel, Save } from '../models/save.model.js';
import type { InteractionTargetModel } from './like.repository.js';

export interface SaveEntity {
  id: string;
  targetId: string;
  postId: string; // alias legacy
  targetModel: InteractionTargetModel;
  userId: string;
  collectionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_TARGET_MODEL: InteractionTargetModel = 'Post';

export interface SaveRepository {
  create(postId: string, userId: string, collectionId?: string, targetModel?: InteractionTargetModel): Promise<SaveEntity>;
  delete(postId: string, userId: string, targetModel?: InteractionTargetModel): Promise<void>;
  exists(postId: string, userId: string, targetModel?: InteractionTargetModel): Promise<boolean>;
  countByPostId(postId: string, targetModel?: InteractionTargetModel): Promise<number>;
  findSavedPostIds(userId: string, postIds: string[], targetModel?: InteractionTargetModel): Promise<string[]>;
  findByUserId(userId: string, limit?: number, cursor?: Date, collectionId?: string, targetModel?: InteractionTargetModel): Promise<{ items: SaveEntity[]; hasMore: boolean }>;
  findByCollectionId(collectionId: string, limit?: number, cursor?: Date, targetModel?: InteractionTargetModel): Promise<{ items: SaveEntity[]; hasMore: boolean }>;
  updateCollection(postId: string, userId: string, collectionId?: string, targetModel?: InteractionTargetModel): Promise<void>;
}

const toDomainSave = (doc: DocumentType<Save>): SaveEntity => {
  const plain = doc.toObject<Save & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    targetId: plain.targetId.toString(),
    postId: plain.targetId.toString(),
    targetModel: plain.targetModel,
    userId: plain.userId.toString(),
    collectionId: plain.collectionId?.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoSaveRepository implements SaveRepository {
  public async create(postId: string, userId: string, collectionId?: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<SaveEntity> {
    const save = await SaveModel.create({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId),
      collectionId: collectionId ? new mongoose.Types.ObjectId(collectionId) : undefined
    });

    return toDomainSave(save);
  }

  public async delete(postId: string, userId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<void> {
    await SaveModel.deleteOne({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }

  public async exists(postId: string, userId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<boolean> {
    const count = await SaveModel.countDocuments({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();

    return count > 0;
  }

  public async countByPostId(postId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<number> {
    return await SaveModel.countDocuments({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }

  public async findSavedPostIds(userId: string, postIds: string[], targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<string[]> {
    if (postIds.length === 0) {
      return [];
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    const saves = await SaveModel.find({
      targetModel,
      userId: new mongoose.Types.ObjectId(userId),
      targetId: { $in: objectIds }
    })
      .select('targetId')
      .exec();

    return saves.map((save) => save.targetId.toString());
  }

  public async findByUserId(userId: string, limit = 20, cursor?: Date, collectionId?: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<{ items: SaveEntity[]; hasMore: boolean }> {
    const query: mongoose.FilterQuery<Save> = {
      targetModel,
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (collectionId) {
      query.collectionId = new mongoose.Types.ObjectId(collectionId);
    } else {
      query.collectionId = { $exists: false };
    }

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

  public async findByCollectionId(collectionId: string, limit = 20, cursor?: Date, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<{ items: SaveEntity[]; hasMore: boolean }> {
    const query: mongoose.FilterQuery<Save> = {
      targetModel,
      collectionId: new mongoose.Types.ObjectId(collectionId)
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

  public async updateCollection(postId: string, userId: string, collectionId?: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<void> {
    const updateQuery = collectionId
      ? { $set: { collectionId: new mongoose.Types.ObjectId(collectionId) } }
      : { $unset: { collectionId: '' } };

    await SaveModel.updateOne(
      {
        targetModel,
        targetId: new mongoose.Types.ObjectId(postId),
        userId: new mongoose.Types.ObjectId(userId)
      },
      updateQuery
    ).exec();
  }
}

