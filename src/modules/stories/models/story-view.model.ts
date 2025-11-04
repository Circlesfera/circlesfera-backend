import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';
import { Story } from './story.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'story_views',
    timestamps: true
  }
})
export class StoryView {
  public id!: string;

  @prop({ required: true, ref: () => Story, type: () => mongoose.Types.ObjectId, index: true })
  public storyId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public viewerId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const StoryViewModel: ReturnModelType<typeof StoryView> = getModelForClass(StoryView);

// Índice compuesto único para evitar vistas duplicadas
StoryViewModel.schema.index({ storyId: 1, viewerId: 1 }, { unique: true });

// Índice para búsqueda rápida de viewers por story
StoryViewModel.schema.index({ storyId: 1, createdAt: -1 });

