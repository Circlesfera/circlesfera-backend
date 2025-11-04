import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

export class PostMedia {
  @prop({ required: true, type: () => String })
  public id!: string;

  @prop({ required: true, type: () => String, enum: ['image', 'video'] })
  public kind!: 'image' | 'video';

  @prop({ required: true, trim: true, type: () => String })
  public url!: string;

  @prop({ required: true, trim: true, type: () => String })
  public thumbnailUrl!: string;

  @prop({ type: () => Number })
  public durationMs?: number;

  @prop({ type: () => Number })
  public width?: number;

  @prop({ type: () => Number })
  public height?: number;
}

@modelOptions({
  schemaOptions: {
    collection: 'posts',
    timestamps: true
  }
})
export class Post {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public authorId!: mongoose.Types.ObjectId;

  @prop({ required: true, trim: true, type: () => String })
  public caption!: string;

  @prop({ type: () => [PostMedia] as never, default: [] })
  public media!: PostMedia[];

  @prop({ type: () => [String] as never, default: [], index: true })
  public hashtags!: string[];

  @prop({ type: () => Number, default: 0 })
  public likes!: number;

  @prop({ type: () => Number, default: 0 })
  public comments!: number;

  @prop({ type: () => Number, default: 0 })
  public saves!: number;

  @prop({ type: () => Number, default: 0 })
  public shares!: number;

  @prop({ type: () => Number, default: 0 })
  public views!: number;

  @prop({ type: () => Boolean, default: false })
  public isDeleted!: boolean;

  @prop({ type: () => Boolean, default: false, index: true })
  public isArchived!: boolean;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const PostModel: ReturnModelType<typeof Post> = getModelForClass(Post);

// Índices críticos para optimización de queries
PostModel.schema.index({ authorId: 1, isDeleted: 1, isArchived: 1, createdAt: -1 }); // Feed del usuario y queries filtradas
PostModel.schema.index({ hashtags: 1, isDeleted: 1, isArchived: 1, createdAt: -1 }); // Búsqueda por hashtag
PostModel.schema.index({ createdAt: -1 }); // Ordenar por fecha (feeds recientes)
PostModel.schema.index({ views: -1, createdAt: -1 }); // Trending posts
PostModel.schema.index({ authorId: 1, createdAt: -1 }); // Posts del usuario ordenados por fecha

