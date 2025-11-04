import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from '@modules/feed/models/post.model.js';
import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'saves',
    timestamps: true
  }
})
export class Save {
  public id!: string;

  @prop({ required: true, ref: () => Post, type: () => mongoose.Types.ObjectId, index: true })
  public postId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public userId!: mongoose.Types.ObjectId;

  @prop({ ref: () => 'Collection', type: () => mongoose.Types.ObjectId, index: true })
  public collectionId?: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const SaveModel: ReturnModelType<typeof Save> = getModelForClass(Save);

// Crear índice compuesto único para evitar saves duplicados
SaveModel.schema.index({ postId: 1, userId: 1 }, { unique: true });

