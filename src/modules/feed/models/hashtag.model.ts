import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from './post.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'hashtags',
    timestamps: true
  }
})
export class Hashtag {
  public id!: string;

  @prop({ required: true, unique: true, lowercase: true, trim: true, type: () => String, index: true })
  public tag!: string;

  @prop({ type: () => Number, default: 0 })
  public postCount!: number;

  @prop({ type: () => Number, default: 0 })
  public lastUsedAt!: number; // Timestamp para ordenar por uso reciente

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const HashtagModel: ReturnModelType<typeof Hashtag> = getModelForClass(Hashtag);

// Índice para búsqueda rápida
HashtagModel.schema.index({ tag: 1 }, { unique: true });
HashtagModel.schema.index({ postCount: -1, lastUsedAt: -1 }); // Para trending

