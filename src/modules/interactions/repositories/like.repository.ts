import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { LikeModel, Like } from '../models/like.model.js';

export interface LikeEntity {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LikeRepository {
  create(postId: string, userId: string): Promise<LikeEntity>;
  delete(postId: string, userId: string): Promise<void>;
  exists(postId: string, userId: string): Promise<boolean>;
  countByPostId(postId: string): Promise<number>;
  findLikedPostIds(userId: string, postIds: string[]): Promise<string[]>;
}

const toDomainLike = (doc: DocumentType<Like>): LikeEntity => {
  const plain = doc.toObject<Like & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    postId: plain.postId.toString(),
    userId: plain.userId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoLikeRepository implements LikeRepository {
  public async create(postId: string, userId: string): Promise<LikeEntity> {
    const like = await LikeModel.create({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    });

    return toDomainLike(like);
  }

  public async delete(postId: string, userId: string): Promise<void> {
    await LikeModel.deleteOne({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }

  public async exists(postId: string, userId: string): Promise<boolean> {
    const count = await LikeModel.countDocuments({
      postId: new mongoose.Types.ObjectId(postId),
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();

    return count > 0;
  }

  public async countByPostId(postId: string): Promise<number> {
    return await LikeModel.countDocuments({
      postId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }

  public async findLikedPostIds(userId: string, postIds: string[]): Promise<string[]> {
    if (postIds.length === 0) {
      return [];
    }

    const objectIds = postIds.map((id) => new mongoose.Types.ObjectId(id));
    const likes = await LikeModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      postId: { $in: objectIds }
    })
      .select('postId')
      .exec();

    return likes.map((like) => like.postId.toString());
  }
}

