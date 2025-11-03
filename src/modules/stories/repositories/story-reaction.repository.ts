import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { StoryReaction, StoryReactionModel, type ReactionEmoji } from '../models/story-reaction.model.js';

export interface StoryReactionEntity {
  id: string;
  storyId: string;
  userId: string;
  emoji: ReactionEmoji;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReactionInput {
  storyId: string;
  userId: string;
  emoji: ReactionEmoji;
}

export interface ReactionCounts {
  [emoji: string]: number;
}

export interface StoryReactionRepository {
  create(data: CreateReactionInput): Promise<StoryReactionEntity>;
  findByStoryId(storyId: string): Promise<StoryReactionEntity[]>;
  findByStoryIdAndUserId(storyId: string, userId: string): Promise<StoryReactionEntity | null>;
  delete(storyId: string, userId: string): Promise<void>;
  countByStoryId(storyId: string): Promise<ReactionCounts>;
  deleteByStoryId(storyId: string): Promise<void>;
}

const toDomainReaction = (doc: DocumentType<StoryReaction>): StoryReactionEntity => {
  const plain = doc.toObject<StoryReaction & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    storyId: plain.storyId.toString(),
    userId: plain.userId.toString(),
    emoji: plain.emoji,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoStoryReactionRepository implements StoryReactionRepository {
  public async create(data: CreateReactionInput): Promise<StoryReactionEntity> {
    // Eliminar reacción existente si existe (solo puede haber una por usuario)
    await this.delete(data.storyId, data.userId);

    const reaction = await StoryReactionModel.create({
      storyId: new mongoose.Types.ObjectId(data.storyId),
      userId: new mongoose.Types.ObjectId(data.userId),
      emoji: data.emoji
    });

    return toDomainReaction(reaction);
  }

  public async findByStoryId(storyId: string): Promise<StoryReactionEntity[]> {
    const objectId = new mongoose.Types.ObjectId(storyId);
    const reactions = await StoryReactionModel.find({ storyId: objectId })
      .sort({ createdAt: -1 })
      .exec();

    return reactions.map((reaction) => toDomainReaction(reaction));
  }

  public async findByStoryIdAndUserId(storyId: string, userId: string): Promise<StoryReactionEntity | null> {
    const storyObjectId = new mongoose.Types.ObjectId(storyId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const reaction = await StoryReactionModel.findOne({
      storyId: storyObjectId,
      userId: userObjectId
    }).exec();

    return reaction ? toDomainReaction(reaction) : null;
  }

  public async delete(storyId: string, userId: string): Promise<void> {
    const storyObjectId = new mongoose.Types.ObjectId(storyId);
    const userObjectId = new mongoose.Types.ObjectId(userId);
    await StoryReactionModel.deleteOne({
      storyId: storyObjectId,
      userId: userObjectId
    }).exec();
  }

  public async countByStoryId(storyId: string): Promise<ReactionCounts> {
    const objectId = new mongoose.Types.ObjectId(storyId);
    const counts = await StoryReactionModel.aggregate([
      { $match: { storyId: objectId } },
      { $group: { _id: '$emoji', count: { $sum: 1 } } }
    ]).exec();

    const result: ReactionCounts = {};
    for (const item of counts) {
      result[item._id] = item.count;
    }

    return result;
  }

  public async deleteByStoryId(storyId: string): Promise<void> {
    const objectId = new mongoose.Types.ObjectId(storyId);
    await StoryReactionModel.deleteMany({ storyId: objectId }).exec();
  }
}

