import mongoose from 'mongoose';

import type { Frame, FrameMedia } from '../models/frame.model.js';
import { FrameModel } from '../models/frame.model.js';

export interface FrameMediaEntity {
  id: string;
  kind: 'video';
  url: string;
  thumbnailUrl?: string;
  durationMs: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface FrameEntity {
  id: string;
  authorId: string;
  caption: string;
  media: FrameMediaEntity[];
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  isDeleted: boolean;
  legacyPostId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FrameCreateInput {
  authorId: string;
  caption: string;
  media: FrameMediaEntity[];
}

export interface FramesQueryOptions {
  limit?: number;
  cursor?: Date;
  excludeAuthorIds?: string[];
}

export interface FramesByAuthorQueryOptions {
  authorIds: string[];
  limit?: number;
  cursor?: Date;
  excludeAuthorIds?: string[];
}

export interface FrameRepository {
  create(input: FrameCreateInput): Promise<FrameEntity>;
  findById(id: string): Promise<FrameEntity | null>;
  findManyByIds(ids: string[]): Promise<FrameEntity[]>;
  deleteById(id: string): Promise<void>;
  incrementLikes(id: string): Promise<void>;
  decrementLikes(id: string): Promise<void>;
  incrementComments(id: string): Promise<void>;
  findFrames(options: FramesQueryOptions): Promise<{ items: FrameEntity[]; hasMore: boolean }>;
  findByAuthorIds(options: FramesByAuthorQueryOptions): Promise<{ items: FrameEntity[]; hasMore: boolean }>;
}

function toEntity(doc: Frame): FrameEntity {
  return {
    id: doc.id,
    authorId: doc.authorId.toString(),
    caption: doc.caption,
    media: doc.media.map((item: FrameMedia) => ({
      id: item.id,
      kind: item.kind,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      durationMs: item.durationMs,
      width: item.width,
      height: item.height,
      rotation: item.rotation
    })),
    likes: doc.likes,
    comments: doc.comments,
    saves: doc.saves,
    shares: doc.shares,
    views: doc.views,
    isDeleted: doc.isDeleted,
    legacyPostId: doc.legacyPostId?.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

export class MongoFrameRepository implements FrameRepository {
  public async create(input: FrameCreateInput): Promise<FrameEntity> {
    const document = await FrameModel.create({
      authorId: new mongoose.Types.ObjectId(input.authorId),
      caption: input.caption,
      media: input.media
    });

    return toEntity(document);
  }

  public async findById(id: string): Promise<FrameEntity | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const document = await FrameModel.findById(id).exec();
    return document ? toEntity(document) : null;
  }

  public async deleteById(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return;
    }

    await FrameModel.findByIdAndUpdate(id, { $set: { isDeleted: true } }).exec();
  }

  public async findManyByIds(ids: string[]): Promise<FrameEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const documents = await FrameModel.find({ _id: { $in: objectIds }, isDeleted: false }).exec();

    return documents.map((doc) => toEntity(doc));
  }

  public async incrementLikes(id: string): Promise<void> {
    await FrameModel.findByIdAndUpdate(id, { $inc: { likes: 1 } }).exec();
  }

  public async decrementLikes(id: string): Promise<void> {
    await FrameModel.updateOne({ _id: id, likes: { $gt: 0 } }, { $inc: { likes: -1 } }).exec();
  }

  public async incrementComments(id: string): Promise<void> {
    await FrameModel.findByIdAndUpdate(id, { $inc: { comments: 1 } }).exec();
  }

  public async findFrames({ limit = 20, cursor, excludeAuthorIds = [] }: FramesQueryOptions): Promise<{ items: FrameEntity[]; hasMore: boolean }> {
    const query: mongoose.FilterQuery<Frame> = {
      isDeleted: false
    };

    if (cursor) {
      query.createdAt = { $lt: cursor } as never;
    }

    if (excludeAuthorIds.length > 0) {
      query.authorId = {
        $nin: excludeAuthorIds.map((id) => new mongoose.Types.ObjectId(id))
      } as never;
    }

    const fetchLimit = limit + 1;
    const documents = await FrameModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toEntity(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async findByAuthorIds({ authorIds, limit = 20, cursor, excludeAuthorIds = [] }: FramesByAuthorQueryOptions): Promise<{ items: FrameEntity[]; hasMore: boolean }> {
    if (authorIds.length === 0) {
      return { items: [], hasMore: false };
    }

    const normalizedAuthorIds = authorIds.map((id) => new mongoose.Types.ObjectId(id));
    const excludedAuthorIds = excludeAuthorIds.map((id) => new mongoose.Types.ObjectId(id));

    const query: mongoose.FilterQuery<Frame> = {
      isDeleted: false,
      authorId: {
        $in: normalizedAuthorIds,
        ...(excludedAuthorIds.length > 0 ? { $nin: excludedAuthorIds } : {})
      }
    };

    if (cursor) {
      query.createdAt = { $lt: cursor } as never;
    }

    const fetchLimit = limit + 1;
    const documents = await FrameModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toEntity(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }
}
