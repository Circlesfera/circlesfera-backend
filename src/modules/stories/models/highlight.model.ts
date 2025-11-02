import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'highlights',
    timestamps: true
  }
})
export class Highlight {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, trim: true, type: () => String, maxlength: 50 })
  public name!: string;

  @prop({ type: () => [mongoose.Types.ObjectId] as never, default: [] })
  public storyIds!: mongoose.Types.ObjectId[]; // IDs de stories incluidas en el highlight

  @prop({ type: () => String, trim: true })
  public coverImageUrl?: string; // URL de la primera imagen del highlight

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const HighlightModel: ReturnModelType<typeof Highlight> = getModelForClass(Highlight);

// Índice compuesto para evitar highlights duplicados con el mismo nombre por usuario
HighlightModel.schema.index({ userId: 1, name: 1 }, { unique: true });

