import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { MentionModel, Mention } from '../models/mention.model.js';

export interface MentionEntity {
  id: string;
  postId: string;
  mentionedUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMentionInput {
  postId: string;
  mentionedUserId: string;
}

export interface MentionRepository {
  create(data: CreateMentionInput): Promise<MentionEntity>;
  createMany(data: CreateMentionInput[]): Promise<MentionEntity[]>;
  findByPostId(postId: string): Promise<MentionEntity[]>;
  findByUserId(userId: string, limit?: number, cursor?: Date): Promise<{ mentions: MentionEntity[]; hasMore: boolean }>;
  deleteByPostId(postId: string): Promise<void>;
}

const toDomainMention = (doc: DocumentType<Mention>): MentionEntity => {
  const plain = doc.toObject<Mention & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    postId: plain.postId.toString(),
    mentionedUserId: plain.mentionedUserId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoMentionRepository implements MentionRepository {
  public async create(data: CreateMentionInput): Promise<MentionEntity> {
    const mention = await MentionModel.create({
      postId: new mongoose.Types.ObjectId(data.postId),
      mentionedUserId: new mongoose.Types.ObjectId(data.mentionedUserId)
    });

    return toDomainMention(mention);
  }

  public async createMany(data: CreateMentionInput[]): Promise<MentionEntity[]> {
    if (data.length === 0) {
      return [];
    }

    // Eliminar duplicados antes de insertar
    const unique = Array.from(
      new Map(data.map((item) => [`${item.postId}-${item.mentionedUserId}`, item])).values()
    );

    const mentions = await MentionModel.insertMany(
      unique.map((item) => ({
        postId: new mongoose.Types.ObjectId(item.postId),
        mentionedUserId: new mongoose.Types.ObjectId(item.mentionedUserId)
      })),
      { ordered: false } // Continuar aunque haya duplicados (serán ignorados por unique index)
    );

    return mentions.map((mention) => toDomainMention(mention));
  }

  public async findByPostId(postId: string): Promise<MentionEntity[]> {
    const mentions = await MentionModel.find({
      postId: new mongoose.Types.ObjectId(postId)
    }).exec();

    return mentions.map((mention) => toDomainMention(mention));
  }

  public async findByUserId(userId: string, limit = 20, cursor?: Date): Promise<{ mentions: MentionEntity[]; hasMore: boolean }> {
    const query: mongoose.FilterQuery<Mention> = {
      mentionedUserId: new mongoose.Types.ObjectId(userId)
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const mentions = await MentionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = mentions.map((mention) => toDomainMention(mention));
    const hasMore = items.length > limit;

    return {
      mentions: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async deleteByPostId(postId: string): Promise<void> {
    await MentionModel.deleteMany({
      postId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }
}

