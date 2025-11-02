import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { StoryModel, Story } from '../models/story.model.js';

export interface StoryMediaEntity {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

export interface StoryEntity {
  id: string;
  authorId: string;
  media: StoryMediaEntity;
  viewCount: number;
  viewerIds: string[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryRepository {
  create(authorId: string, media: StoryMediaEntity): Promise<StoryEntity>;
  findById(storyId: string): Promise<StoryEntity | null>;
  findByAuthorId(authorId: string): Promise<StoryEntity[]>;
  findByAuthorIds(authorIds: string[]): Promise<StoryEntity[]>;
  addViewer(storyId: string, viewerId: string): Promise<void>;
  deleteExpired(): Promise<number>;
  deleteByAuthorId(authorId: string): Promise<void>;
}

const toDomainStoryMedia = (media: Story['media']): StoryMediaEntity => {
  return {
    id: media.id,
    kind: media.kind,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl,
    durationMs: media.durationMs,
    width: media.width,
    height: media.height
  };
};

const toDomainStory = (doc: DocumentType<Story>): StoryEntity => {
  const plain = doc.toObject<Story & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    authorId: plain.authorId.toString(),
    media: toDomainStoryMedia(plain.media),
    viewCount: plain.viewCount,
    viewerIds: plain.viewerIds.map((id) => id.toString()),
    expiresAt: plain.expiresAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoStoryRepository implements StoryRepository {
  public async create(authorId: string, media: StoryMediaEntity): Promise<StoryEntity> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas desde ahora

    const story = await StoryModel.create({
      authorId: new mongoose.Types.ObjectId(authorId),
      media: {
        id: media.id,
        kind: media.kind,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        durationMs: media.durationMs,
        width: media.width,
        height: media.height
      },
      expiresAt
    });

    return toDomainStory(story);
  }

  public async findById(storyId: string): Promise<StoryEntity | null> {
    const story = await StoryModel.findById(storyId).exec();

    if (!story) {
      return null;
    }

    // Verificar si ha expirado
    if (story.expiresAt < new Date()) {
      await StoryModel.deleteOne({ _id: story._id }).exec();
      return null;
    }

    return toDomainStory(story);
  }

  public async findByAuthorId(authorId: string): Promise<StoryEntity[]> {
    const now = new Date();

    const stories = await StoryModel.find({
      authorId: new mongoose.Types.ObjectId(authorId),
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .exec();

    return stories.map((story) => toDomainStory(story));
  }

  public async findByAuthorIds(authorIds: string[]): Promise<StoryEntity[]> {
    if (authorIds.length === 0) {
      return [];
    }

    const now = new Date();

    const stories = await StoryModel.find({
      authorId: { $in: authorIds.map((id) => new mongoose.Types.ObjectId(id)) },
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .exec();

    return stories.map((story) => toDomainStory(story));
  }

  public async addViewer(storyId: string, viewerId: string): Promise<void> {
    const story = await StoryModel.findById(storyId).exec();

    if (!story) {
      return;
    }

    const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
    const alreadyViewed = story.viewerIds.some((id) => id.equals(viewerObjectId));

    if (!alreadyViewed) {
      await StoryModel.findByIdAndUpdate(storyId, {
        $inc: { viewCount: 1 },
        $push: { viewerIds: viewerObjectId }
      }).exec();
    }
  }

  public async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await StoryModel.deleteMany({
      expiresAt: { $lte: now }
    }).exec();

    return result.deletedCount ?? 0;
  }

  public async deleteByAuthorId(authorId: string): Promise<void> {
    await StoryModel.deleteMany({
      authorId: new mongoose.Types.ObjectId(authorId)
    }).exec();
  }
}

