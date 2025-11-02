import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { StoryViewModel, StoryView } from '../models/story-view.model.js';

export interface StoryViewEntity {
  id: string;
  storyId: string;
  viewerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryViewerInfo {
  viewerId: string;
  viewedAt: Date;
}

export interface StoryViewRepository {
  create(storyId: string, viewerId: string): Promise<StoryViewEntity>;
  exists(storyId: string, viewerId: string): Promise<boolean>;
  findViewersByStoryId(storyId: string, limit?: number): Promise<StoryViewerInfo[]>;
  countByStoryId(storyId: string): Promise<number>;
  deleteByStoryId(storyId: string): Promise<void>; // Para limpieza cuando expire la story
}

const toDomainStoryView = (doc: DocumentType<StoryView>): StoryViewEntity => {
  const plain = doc.toObject<StoryView & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    storyId: plain.storyId.toString(),
    viewerId: plain.viewerId.toString(),
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoStoryViewRepository implements StoryViewRepository {
  public async create(storyId: string, viewerId: string): Promise<StoryViewEntity> {
    // Verificar si ya existe (evitar duplicados)
    const existing = await StoryViewModel.findOne({
      storyId: new mongoose.Types.ObjectId(storyId),
      viewerId: new mongoose.Types.ObjectId(viewerId)
    }).exec();

    if (existing) {
      return toDomainStoryView(existing);
    }

    const doc = await StoryViewModel.create({
      storyId: new mongoose.Types.ObjectId(storyId),
      viewerId: new mongoose.Types.ObjectId(viewerId)
    });

    return toDomainStoryView(doc);
  }

  public async exists(storyId: string, viewerId: string): Promise<boolean> {
    const doc = await StoryViewModel.findOne({
      storyId: new mongoose.Types.ObjectId(storyId),
      viewerId: new mongoose.Types.ObjectId(viewerId)
    }).exec();

    return doc !== null;
  }

  public async findViewersByStoryId(storyId: string, limit = 50): Promise<StoryViewerInfo[]> {
    const docs = await StoryViewModel.find({
      storyId: new mongoose.Types.ObjectId(storyId)
    })
      .sort({ createdAt: -1 }) // Más recientes primero
      .limit(limit)
      .select('viewerId createdAt')
      .exec();

    return docs.map((doc) => ({
      viewerId: doc.viewerId.toString(),
      viewedAt: doc.createdAt
    }));
  }

  public async countByStoryId(storyId: string): Promise<number> {
    return await StoryViewModel.countDocuments({
      storyId: new mongoose.Types.ObjectId(storyId)
    }).exec();
  }

  public async deleteByStoryId(storyId: string): Promise<void> {
    await StoryViewModel.deleteMany({
      storyId: new mongoose.Types.ObjectId(storyId)
    }).exec();
  }
}

