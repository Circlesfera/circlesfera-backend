import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Tag, TagModel } from '../models/tag.model.js';

export interface TagEntity {
  id: string;
  postId: string;
  userId: string;
  mediaIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isNormalized: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTagInput {
  postId: string;
  userId: string;
  mediaIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isNormalized?: boolean;
}

export interface TagRepository {
  create(data: CreateTagInput): Promise<TagEntity>;
  findByPostId(postId: string): Promise<TagEntity[]>;
  findByPostIdAndMediaIndex(postId: string, mediaIndex: number): Promise<TagEntity[]>;
  findByUserId(userId: string, limit?: number, cursor?: Date): Promise<{ items: TagEntity[]; hasMore: boolean }>;
  findById(tagId: string): Promise<TagEntity | null>;
  delete(tagId: string): Promise<void>;
  deleteByPostId(postId: string): Promise<void>;
}

const toDomainTag = (doc: DocumentType<Tag>): TagEntity => {
  const plain = doc.toObject<Tag & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    postId: plain.postId.toString(),
    userId: plain.userId.toString(),
    mediaIndex: plain.mediaIndex,
    x: plain.x,
    y: plain.y,
    width: plain.width,
    height: plain.height,
    isNormalized: plain.isNormalized ?? false,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoTagRepository implements TagRepository {
  public async create(data: CreateTagInput): Promise<TagEntity> {
    const tag = await TagModel.create({
      postId: new mongoose.Types.ObjectId(data.postId),
      userId: new mongoose.Types.ObjectId(data.userId),
      mediaIndex: data.mediaIndex,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      isNormalized: data.isNormalized ?? false
    });

    return toDomainTag(tag);
  }

  public async findByPostId(postId: string): Promise<TagEntity[]> {
    const objectId = new mongoose.Types.ObjectId(postId);
    const tags = await TagModel.find({ postId: objectId }).sort({ createdAt: 1 }).exec();

    return tags.map((tag) => toDomainTag(tag));
  }

  public async findByPostIdAndMediaIndex(postId: string, mediaIndex: number): Promise<TagEntity[]> {
    const objectId = new mongoose.Types.ObjectId(postId);
    const tags = await TagModel.find({ postId: objectId, mediaIndex }).sort({ createdAt: 1 }).exec();

    return tags.map((tag) => toDomainTag(tag));
  }

  public async findByUserId(userId: string, limit = 50, cursor?: Date): Promise<{ items: TagEntity[]; hasMore: boolean }> {
    const objectId = new mongoose.Types.ObjectId(userId);
    const query: mongoose.FilterQuery<Tag> = { userId: objectId };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const tags = await TagModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = tags.length > limit;
    const items = tags.slice(0, limit).map((tag) => toDomainTag(tag));

    return { items, hasMore };
  }

  public async findById(tagId: string): Promise<TagEntity | null> {
    const tag = await TagModel.findById(tagId).exec();
    return tag ? toDomainTag(tag) : null;
  }

  public async delete(tagId: string): Promise<void> {
    await TagModel.findByIdAndDelete(tagId).exec();
  }

  public async deleteByPostId(postId: string): Promise<void> {
    const objectId = new mongoose.Types.ObjectId(postId);
    await TagModel.deleteMany({ postId: objectId }).exec();
  }
}

