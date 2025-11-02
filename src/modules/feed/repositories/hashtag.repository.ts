import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { HashtagModel, Hashtag } from '../models/hashtag.model.js';

export interface HashtagEntity {
  id: string;
  tag: string;
  postCount: number;
  lastUsedAt: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HashtagRepository {
  findByTag(tag: string): Promise<HashtagEntity | null>;
  createOrUpdate(tags: string[]): Promise<void>;
  findTrending(limit?: number): Promise<HashtagEntity[]>;
  searchTags(query: string, limit?: number): Promise<HashtagEntity[]>;
}

const toDomainHashtag = (doc: DocumentType<Hashtag>): HashtagEntity => {
  const plain = doc.toObject<Hashtag & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    tag: plain.tag,
    postCount: plain.postCount,
    lastUsedAt: plain.lastUsedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoHashtagRepository implements HashtagRepository {
  public async findByTag(tag: string): Promise<HashtagEntity | null> {
    const hashtag = await HashtagModel.findOne({ tag: tag.toLowerCase().trim() }).exec();
    return hashtag ? toDomainHashtag(hashtag) : null;
  }

  public async createOrUpdate(tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const normalizedTags = tags.map((tag) => tag.toLowerCase().trim()).filter((tag) => tag.length > 0);
    const now = Date.now();

    await Promise.all(
      normalizedTags.map((tag) =>
        HashtagModel.findOneAndUpdate(
          { tag },
          {
            $inc: { postCount: 1 },
            $set: { lastUsedAt: now },
            $setOnInsert: { tag }
          },
          { upsert: true, new: true }
        ).exec()
      )
    );
  }

  public async findTrending(limit = 20): Promise<HashtagEntity[]> {
    const hashtags = await HashtagModel.find({ postCount: { $gt: 0 } })
      .sort({ postCount: -1, lastUsedAt: -1 })
      .limit(limit)
      .exec();

    return hashtags.map((hashtag) => toDomainHashtag(hashtag));
  }

  public async searchTags(query: string, limit = 20): Promise<HashtagEntity[]> {
    const searchRegex = new RegExp(query.toLowerCase().trim(), 'i');
    const hashtags = await HashtagModel.find({ tag: searchRegex })
      .sort({ postCount: -1 })
      .limit(limit)
      .exec();

    return hashtags.map((hashtag) => toDomainHashtag(hashtag));
  }
}

