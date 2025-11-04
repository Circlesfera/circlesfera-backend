import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop, Severity } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'conversations',
    timestamps: true
  },
  options: {
    allowMixed: Severity.ALLOW // Permite usar Mixed sin warnings
  }
})
export class Conversation {
  public id!: string;

  @prop({ required: true, type: () => String, enum: ['direct', 'group'], default: 'direct', index: true })
  public type!: 'direct' | 'group';

  // Para conversaciones directas (legacy, mantenemos compatibilidad)
  @prop({ ref: () => User, type: () => mongoose.Types.ObjectId, index: true, sparse: true })
  public participant1Id?: mongoose.Types.ObjectId;

  @prop({ ref: () => User, type: () => mongoose.Types.ObjectId, index: true, sparse: true })
  public participant2Id?: mongoose.Types.ObjectId;

  // Para grupos
  @prop({ ref: () => User, type: () => [mongoose.Types.ObjectId], index: true, sparse: true })
  public participants?: mongoose.Types.ObjectId[];

  @prop({ type: () => String })
  public groupName?: string;

  @prop({ ref: () => User, type: () => mongoose.Types.ObjectId })
  public createdBy?: mongoose.Types.ObjectId; // Creador del grupo

  @prop({ type: () => Date })
  public lastMessageAt?: Date;

  // Contadores de no leídos para conversaciones directas (legacy)
  @prop({ type: () => Number, default: 0 })
  public unreadCount1!: number;

  @prop({ type: () => Number, default: 0 })
  public unreadCount2!: number;

  // Contadores de no leídos para grupos (Map userId -> count)
  @prop({ type: () => mongoose.Schema.Types.Mixed, default: {} })
  public unreadCounts!: Record<string, number>;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const ConversationModel: ReturnModelType<typeof Conversation> = getModelForClass(Conversation);

// Índice único para evitar duplicados en conversaciones directas
ConversationModel.schema.index({ participant1Id: 1, participant2Id: 1 }, { unique: true, sparse: true });

