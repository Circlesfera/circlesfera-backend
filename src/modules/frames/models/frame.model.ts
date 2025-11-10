import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

export class FrameMedia {
  @prop({ required: true, type: () => String })
  public id!: string;

  @prop({ required: true, type: () => String, enum: ['video'] })
  public kind!: 'video';

  @prop({ required: true, trim: true, type: () => String })
  public url!: string;

  @prop({ trim: true, type: () => String })
  public thumbnailUrl?: string;

  @prop({ type: () => Number, required: true, max: 60_000 })
  public durationMs!: number;

  @prop({ type: () => Number })
  public width?: number;

  @prop({ type: () => Number })
  public height?: number;

  @prop({ type: () => Number })
  public rotation?: number;
}

@modelOptions({
  schemaOptions: {
    collection: 'frames',
    timestamps: true
  }
})
export class Frame {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public authorId!: mongoose.Types.ObjectId;

  @prop({ trim: true, type: () => String, default: '' })
  public caption!: string;

  @prop({
    type: () => [FrameMedia] as never,
    required: true,
    validate: [(value: FrameMedia[]) => value.length === 1, 'Frames must contain exactly one media item']
  })
  public media!: FrameMedia[];

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

  @prop({ type: () => mongoose.Types.ObjectId })
  public legacyPostId?: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const FrameModel: ReturnModelType<typeof Frame> = getModelForClass(Frame);

FrameModel.schema.index({ authorId: 1, isDeleted: 1, createdAt: -1 });
FrameModel.schema.index({ createdAt: -1 });
FrameModel.schema.index({ views: -1, createdAt: -1 });
