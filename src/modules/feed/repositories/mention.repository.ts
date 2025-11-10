import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { MentionModel, Mention } from '../models/mention.model.js';
import type { InteractionTargetModel } from '@modules/interactions/repositories/like.repository.js';

export interface MentionEntity {
  id: string;
  targetId: string;
  postId: string; // alias legacy
  targetModel: InteractionTargetModel;
  mentionedUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMentionInput {
  postId: string;
  mentionedUserId: string;
  targetModel?: InteractionTargetModel;
}

const DEFAULT_TARGET_MODEL: InteractionTargetModel = 'Post';

export interface MentionRepository {
  create(data: CreateMentionInput): Promise<MentionEntity>;
  createMany(data: CreateMentionInput[]): Promise<MentionEntity[]>;
  findByPostId(postId: string, targetModel?: InteractionTargetModel): Promise<MentionEntity[]>;
  findByUserId(userId: string, limit?: number, cursor?: Date): Promise<{ mentions: MentionEntity[]; hasMore: boolean }>;
  deleteByPostId(postId: string, targetModel?: InteractionTargetModel): Promise<void>;
}

const toDomainMention = (doc: DocumentType<Mention>): MentionEntity => {
  const plain = doc.toObject<Mention & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    targetId: plain.targetId.toString(),
    postId: plain.targetId.toString(),
    targetModel: plain.targetModel,
    mentionedUserId: plain.mentionedUserId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoMentionRepository implements MentionRepository {
  public async create(data: CreateMentionInput): Promise<MentionEntity> {
    const targetModel = data.targetModel ?? DEFAULT_TARGET_MODEL;
    const mention = await MentionModel.create({
      targetModel,
      targetId: new mongoose.Types.ObjectId(data.postId),
      mentionedUserId: new mongoose.Types.ObjectId(data.mentionedUserId)
    });

    return toDomainMention(mention);
  }

  public async createMany(data: CreateMentionInput[]): Promise<MentionEntity[]> {
    if (data.length === 0) {
      return [];
    }

    const unique = Array.from(
      new Map(
        data.map((item) => {
          const model = item.targetModel ?? DEFAULT_TARGET_MODEL;
          return [`${model}-${item.postId}-${item.mentionedUserId}`, { ...item, targetModel: model }];
        })
      ).values()
    );

    const mentions = await MentionModel.insertMany(
      unique.map((item) => ({
        targetModel: item.targetModel ?? DEFAULT_TARGET_MODEL,
        targetId: new mongoose.Types.ObjectId(item.postId),
        mentionedUserId: new mongoose.Types.ObjectId(item.mentionedUserId)
      })),
      { ordered: false }
    );

    return mentions.map((mention) => toDomainMention(mention));
  }

  public async findByPostId(postId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<MentionEntity[]> {
    const mentions = await MentionModel.find({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId)
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

  public async deleteByPostId(postId: string, targetModel: InteractionTargetModel = DEFAULT_TARGET_MODEL): Promise<void> {
    await MentionModel.deleteMany({
      targetModel,
      targetId: new mongoose.Types.ObjectId(postId)
    }).exec();
  }
}

