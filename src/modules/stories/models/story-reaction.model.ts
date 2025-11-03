import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Story } from './story.model.js';
import { User } from '@modules/users/models/user.model.js';

// Emojis permitidos para reacciones (similar a Instagram)
export const ALLOWED_REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '💯'] as const;
export type ReactionEmoji = typeof ALLOWED_REACTION_EMOJIS[number];

@modelOptions({
  schemaOptions: {
    collection: 'story_reactions',
    timestamps: true
  }
})
export class StoryReaction {
  public id!: string;

  @prop({ required: true, ref: () => Story, type: () => mongoose.Types.ObjectId, index: true })
  public storyId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => String, enum: ALLOWED_REACTION_EMOJIS })
  public emoji!: ReactionEmoji;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const StoryReactionModel: ReturnModelType<typeof StoryReaction> = getModelForClass(StoryReaction);

// Índice único para evitar múltiples reacciones del mismo usuario en la misma story
StoryReactionModel.schema.index({ storyId: 1, userId: 1 }, { unique: true });

// Índice para contar reacciones por story rápidamente
StoryReactionModel.schema.index({ storyId: 1, createdAt: -1 });

