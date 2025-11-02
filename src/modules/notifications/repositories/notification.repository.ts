import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { NotificationModel, Notification, type NotificationType } from '../models/notification.model.js';

export interface NotificationEntity {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string;
  postId?: string;
  commentId?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  actorId: string;
  postId?: string;
  commentId?: string;
}

export interface NotificationQueryOptions {
  userId: string;
  limit?: number;
  cursor?: Date;
  unreadOnly?: boolean;
}

export interface NotificationQueryResult {
  items: NotificationEntity[];
  hasMore: boolean;
}

export interface NotificationRepository {
  create(data: CreateNotificationInput): Promise<NotificationEntity>;
  findByUserId(options: NotificationQueryOptions): Promise<NotificationQueryResult>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  countUnread(userId: string): Promise<number>;
}

const toDomainNotification = (doc: DocumentType<Notification>): NotificationEntity => {
  const plain = doc.toObject<Notification & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    userId: plain.userId.toString(),
    type: plain.type,
    actorId: plain.actorId.toString(),
    postId: plain.postId?.toString(),
    commentId: plain.commentId?.toString(),
    isRead: plain.isRead,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoNotificationRepository implements NotificationRepository {
  public async create(data: CreateNotificationInput): Promise<NotificationEntity> {
    const notification = await NotificationModel.create({
      userId: new mongoose.Types.ObjectId(data.userId),
      type: data.type,
      actorId: new mongoose.Types.ObjectId(data.actorId),
      postId: data.postId ? new mongoose.Types.ObjectId(data.postId) : undefined,
      commentId: data.commentId ? new mongoose.Types.ObjectId(data.commentId) : undefined
    });

    return toDomainNotification(notification);
  }

  public async findByUserId({ userId, limit = 20, cursor, unreadOnly }: NotificationQueryOptions): Promise<NotificationQueryResult> {
    const query: mongoose.FilterQuery<Notification> = {
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (unreadOnly) {
      query.isRead = false;
    }

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainNotification(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit) : items,
      hasMore
    };
  }

  public async markAsRead(notificationId: string, userId: string): Promise<void> {
    await NotificationModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        userId: new mongoose.Types.ObjectId(userId)
      },
      { isRead: true }
    ).exec();
  }

  public async markAllAsRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        isRead: false
      },
      { isRead: true }
    ).exec();
  }

  public async countUnread(userId: string): Promise<number> {
    return await NotificationModel.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false
    }).exec();
  }
}

