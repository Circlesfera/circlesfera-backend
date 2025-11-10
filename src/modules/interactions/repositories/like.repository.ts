import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { LikeModel, Like } from '../models/like.model.js';

export type InteractionTargetModel = 'Post' | 'Frame';

export interface LikeEntity {
  id: string;
  targetId: string;
  postId: string; // alias legacy
  targetModel: InteractionTargetModel;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LikeRepository {
  create(postId: string, userId: string, targetModel?: InteractionTargetModel): Promise<LikeEntity>;
  delete(postId: string, userId: string, targetModel?: InteractionTargetModel): Promise<void>;
  exists(postId: string, userId: string, targetModel?: InteractionTargetModel): Promise<boolean>;
  countByPostId(postId: string, targetModel?: InteractionTargetModel): Promise<number>;
  findLikedPostIds(userId: string, postIds: string[], targetModel?: InteractionTargetModel): Promise<string[]>;
}

const toDomainLike = (doc: DocumentType<Like>): LikeEntity => {
  const plain = doc.toObject<Like & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    targetId: plain.targetId.toString(),
    postId: plain.targetId.toString(),
    targetModel: plain.targetModel,
    userId: plain.userId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

const DEFAULT_TARGET_MODEL: InteractionTargetModel = 'Post';

export class MongoLikeRepository implements LikeRepository {
  public async create(postId: string, userId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<LikeEntity> {
    const like = await LikeModel.create({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    });

    return toDomainLike(like);
  }

  public async delete(postId: string, userId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<void> {
    await LikeModel.deleteOne({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }

  public async exists(postId: string, userId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<boolean> {
    const count = await LikeModel.countDocuments({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();

    return count > 0;
  }

  public async countByPostId(postId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<number> {
    return await LikeModel.countDocuments({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }

  public async findLikedPostIds(userId: string, postIds: string[], targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<string[]> {
    if (postIds.length === 0) {
      return [];
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    const likes = await LikeModel.find({
      targetModel,
      userId: new mongoose.Types.ObjectId(userId),
      targetId: { $in: objectIds }
    })
      .select('targetId')
      .exec();

    return likes.map((like) => like.targetId.toString());
  }
}

