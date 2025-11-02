import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Message, MessageModel } from '../models/message.model.js';

export interface MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
}

export interface MessageQueryOptions {
  conversationId: string;
  limit?: number;
  cursor?: Date;
}

export interface MessageQueryResult {
  items: MessageEntity[];
  hasMore: boolean;
}

export interface MessageRepository {
  create(data: CreateMessageInput): Promise<MessageEntity>;
  findByConversationId(options: MessageQueryOptions): Promise<MessageQueryResult>;
  markAsRead(messageId: string): Promise<void>;
  markConversationAsRead(conversationId: string, userId: string): Promise<void>;
  countUnread(conversationId: string, userId: string): Promise<number>;
}

const toDomainMessage = (doc: DocumentType<Message>): MessageEntity => {
  const plain = doc.toObject<Message & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    conversationId: plain.conversationId.toString(),
    senderId: plain.senderId.toString(),
    content: plain.content,
    isRead: plain.isRead,
    readAt: plain.readAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoMessageRepository implements MessageRepository {
  public async create(data: CreateMessageInput): Promise<MessageEntity> {
    const message = await MessageModel.create({
      conversationId: new mongoose.Types.ObjectId(data.conversationId),
      senderId: new mongoose.Types.ObjectId(data.senderId),
      content: data.content
    });

    return toDomainMessage(message);
  }

  public async findByConversationId({ conversationId, limit = 50, cursor }: MessageQueryOptions): Promise<MessageQueryResult> {
    const query: mongoose.FilterQuery<Message> = {
      conversationId: new mongoose.Types.ObjectId(conversationId)
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const fetchLimit = limit + 1;
    const documents = await MessageModel.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .exec();

    const items = documents.map((doc) => toDomainMessage(doc));
    const hasMore = items.length > limit;

    return {
      items: hasMore ? items.slice(0, limit).reverse() : items.reverse(), // Orden cronológico (más antiguo primero)
      hasMore
    };
  }

  public async markAsRead(messageId: string): Promise<void> {
    await MessageModel.findByIdAndUpdate(messageId, {
      $set: { isRead: true, readAt: new Date() }
    }).exec();
  }

  public async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    await MessageModel.updateMany(
      {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        isRead: false
      },
      {
        $set: { isRead: true, readAt: new Date() }
      }
    ).exec();
  }

  public async countUnread(conversationId: string, userId: string): Promise<number> {
    return await MessageModel.countDocuments({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      isRead: false
    }).exec();
  }
}

