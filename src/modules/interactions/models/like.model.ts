import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from '@modules/feed/models/post.model.js';
import { Frame } from '@modules/frames/models/frame.model.js';
import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'likes',
    timestamps: true
  }
})
export class Like {
  public id!: string;

  @prop({ required: true, enum: ['Post', 'Frame'], type: () => String, default: 'Post' })
  public targetModel!: 'Post' | 'Frame';

  @prop({ required: true, refPath: 'targetModel', type: () => mongoose.Types.ObjectId, index: true })
  public targetId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public userId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const LikeModel: ReturnModelType<typeof Like> = getModelForClass(Like);

LikeModel.schema.index({ targetModel: 1, targetId: 1, userId: 1 }, { unique: true });
LikeModel.schema.index({ userId: 1, createdAt: -1 });

