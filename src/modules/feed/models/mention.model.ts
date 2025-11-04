import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';
import { Post } from './post.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'mentions',
    timestamps: true
  }
})
export class Mention {
  public id!: string;

  @prop({ required: true, ref: () => Post, type: () => mongoose.Types.ObjectId, index: true })
  public postId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public mentionedUserId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const MentionModel: ReturnModelType<typeof Mention> = getModelForClass(Mention);

// Índice compuesto para búsquedas eficientes
MentionModel.schema.index({ postId: 1, mentionedUserId: 1 }, { unique: true });
MentionModel.schema.index({ mentionedUserId: 1, createdAt: -1 });

