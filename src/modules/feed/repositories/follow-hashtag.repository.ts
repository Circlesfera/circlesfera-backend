import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { FollowHashtagModel, FollowHashtag } from '../models/follow-hashtag.model.js';

export interface FollowHashtagEntity {
  id: string;
  userId: string;
  hashtag: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowHashtagRepository {
  create(userId: string, hashtag: string): Promise<FollowHashtagEntity>;
  delete(userId: string, hashtag: string): Promise<void>;
  exists(userId: string, hashtag: string): Promise<boolean>;
  findFollowedTags(userId: string): Promise<string[]>; // Retorna array de tags seguidos
  countFollowing(userId: string): Promise<number>;
}

const toDomainFollowHashtag = (doc: DocumentType<FollowHashtag>): FollowHashtagEntity => {
  const plain = doc.toObject<FollowHashtag & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    userId: plain.userId.toString(),
    hashtag: plain.hashtag,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoFollowHashtagRepository implements FollowHashtagRepository {
  public async create(userId: string, hashtag: string): Promise<FollowHashtagEntity> {
    const normalizedTag = hashtag.toLowerCase().trim().replace(/^#/, '');

    const existing = await FollowHashtagModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      hashtag: normalizedTag
    }).exec();

    if (existing) {
      return toDomainFollowHashtag(existing);
    }

    const doc = await FollowHashtagModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      hashtag: normalizedTag
    });

    return toDomainFollowHashtag(doc);
  }

  public async delete(userId: string, hashtag: string): Promise<void> {
    const normalizedTag = hashtag.toLowerCase().trim().replace(/^#/, '');

    await FollowHashtagModel.deleteOne({
      userId: new mongoose.Types.ObjectId(userId),
      hashtag: normalizedTag
    }).exec();
  }

  public async exists(userId: string, hashtag: string): Promise<boolean> {
    const normalizedTag = hashtag.toLowerCase().trim().replace(/^#/, '');
    const doc = await FollowHashtagModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      hashtag: normalizedTag
    }).exec();

    return doc !== null;
  }

  public async findFollowedTags(userId: string): Promise<string[]> {
    const docs = await FollowHashtagModel.find({
      userId: new mongoose.Types.ObjectId(userId)
    })
      .select('hashtag')
      .exec();

    return docs.map((doc) => doc.hashtag);
  }

  public async countFollowing(userId: string): Promise<number> {
    return await FollowHashtagModel.countDocuments({
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();
  }
}

