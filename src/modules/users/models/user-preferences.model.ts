import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from './user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'user_preferences',
    timestamps: true
  }
})
export class UserPreferences {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, unique: true, index: true })
  public userId!: mongoose.Types.ObjectId;

  // Privacidad
  @prop({ type: () => Boolean, default: false })
  public isPrivate!: boolean;

  @prop({ type: () => Boolean, default: true })
  public showActivityStatus!: boolean;

  @prop({ type: () => String, enum: ['everyone', 'followers', 'nobody'], default: 'everyone' })
  public whoCanComment!: 'everyone' | 'followers' | 'nobody';

  @prop({ type: () => String, enum: ['everyone', 'followers', 'nobody'], default: 'everyone' })
  public whoCanMention!: 'everyone' | 'followers' | 'nobody';

  // Notificaciones
  @prop({ type: () => Boolean, default: true })
  public notificationsLikes!: boolean;

  @prop({ type: () => Boolean, default: true })
  public notificationsComments!: boolean;

  @prop({ type: () => Boolean, default: true })
  public notificationsFollows!: boolean;

  @prop({ type: () => Boolean, default: true })
  public notificationsMentions!: boolean;

  @prop({ type: () => Boolean, default: true })
  public notificationsReplies!: boolean;

  @prop({ type: () => Boolean, default: true })
  public notificationsTags!: boolean;

  @prop({ type: () => Boolean, default: true })
  public notificationsShares!: boolean;

  // Aplicación
  @prop({ type: () => String, enum: ['light', 'dark', 'system'], default: 'dark' })
  public theme!: 'light' | 'dark' | 'system';

  @prop({ type: () => String, enum: ['es', 'en'], default: 'es' })
  public language!: 'es' | 'en';

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const UserPreferencesModel: ReturnModelType<typeof UserPreferences> =
  getModelForClass(UserPreferences);

