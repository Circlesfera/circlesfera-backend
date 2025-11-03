import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { UserPreferences, UserPreferencesModel } from '../models/user-preferences.model.js';

export interface PreferencesEntity {
  id: string;
  userId: string;
  isPrivate: boolean;
  showActivityStatus: boolean;
  whoCanComment: 'everyone' | 'followers' | 'nobody';
  whoCanMention: 'everyone' | 'followers' | 'nobody';
  notificationsLikes: boolean;
  notificationsComments: boolean;
  notificationsFollows: boolean;
  notificationsMentions: boolean;
  notificationsReplies: boolean;
  notificationsTags: boolean;
  notificationsShares: boolean;
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en';
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePreferencesInput {
  isPrivate?: boolean;
  showActivityStatus?: boolean;
  whoCanComment?: 'everyone' | 'followers' | 'nobody';
  whoCanMention?: 'everyone' | 'followers' | 'nobody';
  notificationsLikes?: boolean;
  notificationsComments?: boolean;
  notificationsFollows?: boolean;
  notificationsMentions?: boolean;
  notificationsReplies?: boolean;
  notificationsTags?: boolean;
  notificationsShares?: boolean;
  theme?: 'light' | 'dark' | 'system';
  language?: 'es' | 'en';
}

const toDomainPreferences = (doc: DocumentType<UserPreferences>): PreferencesEntity => {
  const plain = doc.toObject<UserPreferences & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    userId: plain.userId.toString(),
    isPrivate: plain.isPrivate,
    showActivityStatus: plain.showActivityStatus,
    whoCanComment: plain.whoCanComment,
    whoCanMention: plain.whoCanMention,
    notificationsLikes: plain.notificationsLikes,
    notificationsComments: plain.notificationsComments,
    notificationsFollows: plain.notificationsFollows,
    notificationsMentions: plain.notificationsMentions,
    notificationsReplies: plain.notificationsReplies,
    notificationsTags: plain.notificationsTags,
    notificationsShares: plain.notificationsShares,
    theme: plain.theme,
    language: plain.language,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export interface PreferencesRepository {
  findByUserId(userId: string): Promise<PreferencesEntity | null>;
  create(userId: string): Promise<PreferencesEntity>;
  update(userId: string, updates: UpdatePreferencesInput): Promise<PreferencesEntity | null>;
}

export class MongoPreferencesRepository implements PreferencesRepository {
  public async findByUserId(userId: string): Promise<PreferencesEntity | null> {
    const doc = await UserPreferencesModel.findOne({
      userId: new mongoose.Types.ObjectId(userId)
    }).exec();

    return doc ? toDomainPreferences(doc) : null;
  }

  public async create(userId: string): Promise<PreferencesEntity> {
    const doc = await UserPreferencesModel.create({
      userId: new mongoose.Types.ObjectId(userId)
    });

    return toDomainPreferences(doc);
  }

  public async update(userId: string, updates: UpdatePreferencesInput): Promise<PreferencesEntity | null> {
    const doc = await UserPreferencesModel.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: updates },
      { new: true, runValidators: true }
    ).exec();

    return doc ? toDomainPreferences(doc) : null;
  }
}

