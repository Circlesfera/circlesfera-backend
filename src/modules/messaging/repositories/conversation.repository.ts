import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Conversation, ConversationModel } from '../models/conversation.model.js';

export interface ConversationEntity {
  id: string;
  type: 'direct' | 'group';
  participant1Id?: string;
  participant2Id?: string;
  participants?: string[];
  groupName?: string;
  createdBy?: string;
  lastMessageAt?: Date;
  unreadCount1: number;
  unreadCount2: number;
  unreadCounts: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationInput {
  participant1Id: string;
  participant2Id: string;
}

export interface CreateGroupInput {
  participants: string[];
  groupName: string;
  createdBy: string;
}

export interface ConversationRepository {
  findOrCreate(data: CreateConversationInput): Promise<ConversationEntity>;
  createGroup(data: CreateGroupInput): Promise<ConversationEntity>;
  findByUserId(userId: string): Promise<ConversationEntity[]>;
  findById(conversationId: string): Promise<ConversationEntity | null>;
  findByParticipants(participant1Id: string, participant2Id: string): Promise<ConversationEntity | null>;
  updateLastMessage(conversationId: string, timestamp: Date): Promise<void>;
  incrementUnread(conversationId: string, userId: string): Promise<void>;
  resetUnread(conversationId: string, userId: string): Promise<void>;
  addParticipant(conversationId: string, userId: string): Promise<void>;
  removeParticipant(conversationId: string, userId: string): Promise<void>;
  updateGroupName(conversationId: string, groupName: string): Promise<void>;
}

const toDomainConversation = (doc: DocumentType<Conversation>): ConversationEntity => {
  const plain = doc.toObject<Conversation & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    type: plain.type || 'direct',
    participant1Id: plain.participant1Id?.toString(),
    participant2Id: plain.participant2Id?.toString(),
    participants: plain.participants?.map((p) => p.toString()),
    groupName: plain.groupName,
    createdBy: plain.createdBy?.toString(),
    lastMessageAt: plain.lastMessageAt,
    unreadCount1: plain.unreadCount1 ?? 0,
    unreadCount2: plain.unreadCount2 ?? 0,
    unreadCounts: plain.unreadCounts ?? {},
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoConversationRepository implements ConversationRepository {
  public async findOrCreate(data: CreateConversationInput): Promise<ConversationEntity> {
    // Normalizar IDs para evitar duplicados (menor ID siempre en participant1Id)
    const id1 = new mongoose.Types.ObjectId(data.participant1Id);
    const id2 = new mongoose.Types.ObjectId(data.participant2Id);

    let participant1Id = id1 < id2 ? id1 : id2;
    let participant2Id = id1 < id2 ? id2 : id1;

    let conversation = await ConversationModel.findOne({
      participant1Id,
      participant2Id
    }).exec();

    if (!conversation) {
      conversation = await ConversationModel.create({
        participant1Id,
        participant2Id
      });
    }

    return toDomainConversation(conversation);
  }

  public async createGroup(data: CreateGroupInput): Promise<ConversationEntity> {
    const conversation = await ConversationModel.create({
      type: 'group',
      participants: data.participants.map((id) => new mongoose.Types.ObjectId(id)),
      groupName: data.groupName,
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
      unreadCounts: {}
    });

    return toDomainConversation(conversation);
  }

  public async findByUserId(userId: string): Promise<ConversationEntity[]> {
    const objectId = new mongoose.Types.ObjectId(userId);
    const conversations = await ConversationModel.find({
      $or: [
        { participant1Id: objectId },
        { participant2Id: objectId },
        { participants: objectId }
      ]
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .exec();

    return conversations.map((conv) => toDomainConversation(conv));
  }

  public async findById(conversationId: string): Promise<ConversationEntity | null> {
    const conversation = await ConversationModel.findById(conversationId).exec();
    return conversation ? toDomainConversation(conversation) : null;
  }

  public async findByParticipants(participant1Id: string, participant2Id: string): Promise<ConversationEntity | null> {
    const id1 = new mongoose.Types.ObjectId(participant1Id);
    const id2 = new mongoose.Types.ObjectId(participant2Id);

    const p1 = id1 < id2 ? id1 : id2;
    const p2 = id1 < id2 ? id2 : id1;

    const conversation = await ConversationModel.findOne({
      participant1Id: p1,
      participant2Id: p2
    }).exec();

    return conversation ? toDomainConversation(conversation) : null;
  }

  public async updateLastMessage(conversationId: string, timestamp: Date): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: { lastMessageAt: timestamp }
    }).exec();
  }

  public async incrementUnread(conversationId: string, userId: string): Promise<void> {
    const conversation = await ConversationModel.findById(conversationId).exec();
    if (!conversation) {
      return;
    }

    if (conversation.type === 'group') {
      // Para grupos, usar unreadCounts
      const unreadCounts = conversation.unreadCounts || {};
      unreadCounts[userId] = (unreadCounts[userId] || 0) + 1;
      await ConversationModel.findByIdAndUpdate(conversationId, {
        $set: { [`unreadCounts.${userId}`]: unreadCounts[userId] }
      }).exec();
    } else {
      // Para conversaciones directas, mantener compatibilidad
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const isParticipant1 = conversation.participant1Id?.equals(userIdObj);
      await ConversationModel.findByIdAndUpdate(conversationId, {
        $inc: isParticipant1 ? { unreadCount1: 1 } : { unreadCount2: 1 }
      }).exec();
    }
  }

  public async resetUnread(conversationId: string, userId: string): Promise<void> {
    const conversation = await ConversationModel.findById(conversationId).exec();
    if (!conversation) {
      return;
    }

    if (conversation.type === 'group') {
      // Para grupos, usar unreadCounts
      await ConversationModel.findByIdAndUpdate(conversationId, {
        $set: { [`unreadCounts.${userId}`]: 0 }
      }).exec();
    } else {
      // Para conversaciones directas, mantener compatibilidad
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const isParticipant1 = conversation.participant1Id?.equals(userIdObj);
      await ConversationModel.findByIdAndUpdate(conversationId, {
        $set: isParticipant1 ? { unreadCount1: 0 } : { unreadCount2: 0 }
      }).exec();
    }
  }

  public async addParticipant(conversationId: string, userId: string): Promise<void> {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $addToSet: { participants: userIdObj },
      $set: { [`unreadCounts.${userId}`]: 0 }
    }).exec();
  }

  public async removeParticipant(conversationId: string, userId: string): Promise<void> {
    const userIdObj = new mongoose.Types.ObjectId(userId);
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $pull: { participants: userIdObj },
      $unset: { [`unreadCounts.${userId}`]: '' }
    }).exec();
  }

  public async updateGroupName(conversationId: string, groupName: string): Promise<void> {
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: { groupName }
    }).exec();
  }
}

