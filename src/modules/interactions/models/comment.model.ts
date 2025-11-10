import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from '@modules/feed/models/post.model.js';
import { Frame } from '@modules/frames/models/frame.model.js';
import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'comments',
    timestamps: true
  }
})
export class Comment {
  public id!: string;

  @prop({ required: true, enum: ['Post', 'Frame'], type: () => String, default: 'Post' })
  public targetModel!: 'Post' | 'Frame';

  @prop({ required: true, refPath: 'targetModel', type: () => mongoose.Types.ObjectId, index: true })
  public targetId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public authorId!: mongoose.Types.ObjectId;

  @prop({ ref: () => Comment, type: () => mongoose.Types.ObjectId, index: true })
  public parentId?: mongoose.Types.ObjectId; // Para replies

  @prop({ required: true, trim: true, type: () => String, maxlength: 2200 })
  public content!: string;

  @prop({ type: () => Number, default: 0 })
  public likes!: number;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const CommentModel: ReturnModelType<typeof Comment> = getModelForClass(Comment);

CommentModel.schema.index({ targetModel: 1, targetId: 1, createdAt: -1 });
CommentModel.schema.index({ authorId: 1, createdAt: -1 });
CommentModel.schema.index({ parentId: 1, createdAt: -1 });

