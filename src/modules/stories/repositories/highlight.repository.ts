import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { HighlightModel, Highlight } from '../models/highlight.model.js';

export interface HighlightEntity {
  id: string;
  userId: string;
  name: string;
  storyIds: string[];
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HighlightRepository {
  create(userId: string, name: string): Promise<HighlightEntity>;
  findById(highlightId: string): Promise<HighlightEntity | null>;
  findByUserId(userId: string): Promise<HighlightEntity[]>;
  update(highlightId: string, updates: { name?: string; storyIds?: string[]; coverImageUrl?: string }): Promise<HighlightEntity>;
  delete(highlightId: string): Promise<void>;
  addStory(highlightId: string, storyId: string): Promise<void>;
  removeStory(highlightId: string, storyId: string): Promise<void>;
}

const toDomainHighlight = (doc: DocumentType<Highlight>): HighlightEntity => {
  const plain = doc.toObject<Highlight & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    userId: plain.userId.toString(),
    name: plain.name,
    storyIds: plain.storyIds.map((id) => id.toString()),
    coverImageUrl: plain.coverImageUrl,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoHighlightRepository implements HighlightRepository {
  public async create(userId: string, name: string): Promise<HighlightEntity> {
    const highlight = await HighlightModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      name
    });

    return toDomainHighlight(highlight);
  }

  public async findById(highlightId: string): Promise<HighlightEntity | null> {
    const highlight = await HighlightModel.findById(highlightId).exec();

    if (!highlight) {
      return null;
    }

    return toDomainHighlight(highlight);
  }

  public async findByUserId(userId: string): Promise<HighlightEntity[]> {
    const highlights = await HighlightModel.find({
      userId: new mongoose.Types.ObjectId(userId)
    })
      .sort({ createdAt: -1 })
      .exec();

    return highlights.map((highlight) => toDomainHighlight(highlight));
  }

  public async update(highlightId: string, updates: { name?: string; storyIds?: string[]; coverImageUrl?: string }): Promise<HighlightEntity> {
    const updateData: Partial<Highlight> = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.storyIds !== undefined) {
      updateData.storyIds = updates.storyIds.map((id) => new mongoose.Types.ObjectId(id)) as never;
    }

    if (updates.coverImageUrl !== undefined) {
      updateData.coverImageUrl = updates.coverImageUrl;
    }

    const highlight = await HighlightModel.findByIdAndUpdate(highlightId, { $set: updateData }, { new: true }).exec();

    if (!highlight) {
      throw new Error('Highlight no encontrado');
    }

    return toDomainHighlight(highlight);
  }

  public async delete(highlightId: string): Promise<void> {
    await HighlightModel.findByIdAndDelete(highlightId).exec();
  }

  public async addStory(highlightId: string, storyId: string): Promise<void> {
    await HighlightModel.findByIdAndUpdate(highlightId, {
      $addToSet: { storyIds: new mongoose.Types.ObjectId(storyId) }
    }).exec();
  }

  public async removeStory(highlightId: string, storyId: string): Promise<void> {
    await HighlightModel.findByIdAndUpdate(highlightId, {
      $pull: { storyIds: new mongoose.Types.ObjectId(storyId) }
    }).exec();
  }
}

