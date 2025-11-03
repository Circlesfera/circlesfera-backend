import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from '@modules/feed/models/post.model.js';
import { User } from '@modules/users/models/user.model.js';

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'tagged' | 'share';

@modelOptions({
  schemaOptions: {
    collection: 'notifications',
    timestamps: true
  }
})
export class Notification {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => String })
  public type!: NotificationType;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public actorId!: mongoose.Types.ObjectId;

  @prop({ ref: () => Post, type: () => mongoose.Types.ObjectId })
  public postId?: mongoose.Types.ObjectId;

  @prop({ type: () => mongoose.Types.ObjectId })
  public commentId?: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => Boolean, default: false, index: true })
  public isRead!: boolean;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const NotificationModel: ReturnModelType<typeof Notification> = getModelForClass(Notification);

// Índices para consultas rápidas
NotificationModel.schema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationModel.schema.index({ userId: 1, createdAt: -1 });

