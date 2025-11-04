import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';
import { Post } from '@modules/feed/models/post.model.js';

export type ReportTargetType = 'post' | 'comment' | 'user';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'violence'
  | 'copyright'
  | 'false_information'
  | 'other';

@modelOptions({
  schemaOptions: {
    collection: 'reports',
    timestamps: true
  }
})
export class Report {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public reporterId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => String, enum: ['post', 'comment', 'user'] })
  public targetType!: ReportTargetType;

  @prop({ required: true, type: () => mongoose.Types.ObjectId, index: true })
  public targetId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => String, enum: ['spam', 'harassment', 'inappropriate', 'violence', 'copyright', 'false_information', 'other'] })
  public reason!: ReportReason;

  @prop({ trim: true, type: () => String, maxlength: 500 })
  public details?: string;

  @prop({ type: () => String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' })
  public status!: 'pending' | 'reviewed' | 'resolved' | 'dismissed';

  @prop({ ref: () => User, type: () => mongoose.Types.ObjectId })
  public reviewedBy?: mongoose.Types.ObjectId;

  @prop({ type: () => Date })
  public reviewedAt?: Date;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const ReportModel: ReturnModelType<typeof Report> = getModelForClass(Report);

// Índices para consultas eficientes
ReportModel.schema.index({ targetType: 1, targetId: 1 });
ReportModel.schema.index({ status: 1, createdAt: -1 });

