import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from '@modules/feed/models/post.model.js';
import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'likes',
    timestamps: true
  }
})
export class Like {
  public id!: string;

  @prop({ required: true, ref: () => Post, type: () => mongoose.Types.ObjectId, index: true })
  public postId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public userId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const LikeModel: ReturnModelType<typeof Like> = getModelForClass(Like);

// Crear índice compuesto único para evitar likes duplicados
LikeModel.schema.index({ postId: 1, userId: 1 }, { unique: true });

