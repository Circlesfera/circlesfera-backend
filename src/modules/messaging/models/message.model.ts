import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';
import { Conversation } from './conversation.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'messages',
    timestamps: true
  }
})
export class Message {
  public id!: string;

  @prop({ required: true, ref: () => Conversation, type: () => mongoose.Types.ObjectId, index: true })
  public conversationId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public senderId!: mongoose.Types.ObjectId;

  @prop({ required: true, trim: true, type: () => String, maxlength: 5000 })
  public content!: string;

  @prop({ type: () => Boolean, default: false })
  public isRead!: boolean;

  @prop({ type: () => Date })
  public readAt?: Date;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const MessageModel: ReturnModelType<typeof Message> = getModelForClass(Message);

// Índices para optimizar consultas
MessageModel.schema.index({ conversationId: 1, createdAt: -1 });
MessageModel.schema.index({ senderId: 1, createdAt: -1 });

