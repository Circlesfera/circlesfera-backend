import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';
import { Post } from './post.model.js';
import { Frame } from '@modules/frames/models/frame.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'mentions',
    timestamps: true
  }
})
export class Mention {
  public id!: string;

  @prop({ required: true, enum: ['Post', 'Frame'], type: () => String, default: 'Post' })
  public targetModel!: 'Post' | 'Frame';

  @prop({ required: true, refPath: 'targetModel', type: () => mongoose.Types.ObjectId, index: true })
  public targetId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public mentionedUserId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const MentionModel: ReturnModelType<typeof Mention> = getModelForClass(Mention);

MentionModel.schema.index({ targetModel: 1, targetId: 1, mentionedUserId: 1 }, { unique: true });
MentionModel.schema.index({ mentionedUserId: 1, createdAt: -1 });

