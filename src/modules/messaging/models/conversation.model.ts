import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'conversations',
    timestamps: true
  }
})
export class Conversation {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public participant1Id!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public participant2Id!: mongoose.Types.ObjectId;

  @prop({ type: () => Date })
  public lastMessageAt?: Date;

  @prop({ type: () => Number, default: 0 })
  public unreadCount1!: number; // Mensajes no leídos para participant1

  @prop({ type: () => Number, default: 0 })
  public unreadCount2!: number; // Mensajes no leídos para participant2

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const ConversationModel: ReturnModelType<typeof Conversation> = getModelForClass(Conversation);

// Índice único para evitar duplicados (una conversación por par de usuarios)
ConversationModel.schema.index({ participant1Id: 1, participant2Id: 1 }, { unique: true });

