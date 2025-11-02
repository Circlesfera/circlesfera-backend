import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

export class StoryMedia {
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
    collection: 'stories',
    timestamps: true
  }
})
export class Story {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public authorId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => StoryMedia })
  public media!: StoryMedia;

  @prop({ type: () => Number, default: 0 })
  public viewCount!: number;

  @prop({ type: () => [mongoose.Types.ObjectId] as never, default: [], ref: () => User })
  public viewerIds!: mongoose.Types.ObjectId[];

  @prop({ type: () => Date, required: true, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) })
  public expiresAt!: Date;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const StoryModel: ReturnModelType<typeof Story> = getModelForClass(Story);

