import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { FollowModel, Follow } from '../models/follow.model.js';

export interface FollowEntity {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowRepository {
  create(followerId: string, followingId: string): Promise<FollowEntity>;
  delete(followerId: string, followingId: string): Promise<void>;
  exists(followerId: string, followingId: string): Promise<boolean>;
  findFollowingIds(followerId: string): Promise<string[]>;
  findFollowerIds(followingId: string): Promise<string[]>;
  countFollowers(userId: string): Promise<number>;
  countFollowing(userId: string): Promise<number>;
}

const toDomainFollow = (doc: DocumentType<Follow>): FollowEntity => {
  const plain = doc.toObject<Follow & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    followerId: plain.followerId.toString(),
    followingId: plain.followingId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoFollowRepository implements FollowRepository {
  public async create(followerId: string, followingId: string): Promise<FollowEntity> {
    if (followerId === followingId) {
      throw new Error('Un usuario no puede seguirse a sí mismo');
    }

    const existing = await FollowModel.findOne({
      followerId: new mongoose.Types.ObjectId(followerId),
      followingId: new mongoose.Types.ObjectId(followingId)
    }).exec();

    if (existing) {
      return toDomainFollow(existing);
    }

    const follow = await FollowModel.create({
      followerId: new mongoose.Types.ObjectId(followerId),
      followingId: new mongoose.Types.ObjectId(followingId)
    });

    return toDomainFollow(follow);
  }

  public async delete(followerId: string, followingId: string): Promise<void> {
    await FollowModel.deleteOne({
      followerId: new mongoose.Types.ObjectId(followerId),
      followingId: new mongoose.Types.ObjectId(followingId)
    }).exec();
  }

  public async exists(followerId: string, followingId: string): Promise<boolean> {
    const count = await FollowModel.countDocuments({
      followerId: new mongoose.Types.ObjectId(followerId),
      followingId: new mongoose.Types.ObjectId(followingId)
    }).exec();

    return count > 0;
  }

  public async findFollowingIds(followerId: string): Promise<string[]> {
    const follows = await FollowModel.find({
      followerId: new mongoose.Types.ObjectId(followerId)
    })
      .select('followingId')
      .exec();

    return follows.map((follow) => follow.followingId.toString());
  }

  public async findFollowerIds(followingId: string): Promise<string[]> {
    const follows = await FollowModel.find({
      followingId: new mongoose.Types.ObjectId(followingId)
    })
      .select('followerId')
      .exec();

    return follows.map((follow) => follow.followerId.toString());
  }

  public async countFollowers(userId: string): Promise<number> {
    return await FollowModel.countDocuments({
      followingId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }

  public async countFollowing(userId: string): Promise<number> {
    return await FollowModel.countDocuments({
      followerId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }
}

