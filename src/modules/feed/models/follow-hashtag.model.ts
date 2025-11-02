import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'follow_hashtags',
    timestamps: true
  }
})
export class FollowHashtag {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => String, index: true })
  public hashtag!: string; // Tag normalizado (lowercase)

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const FollowHashtagModel: ReturnModelType<typeof FollowHashtag> = getModelForClass(FollowHashtag);

// Índice compuesto único para evitar follows duplicados
FollowHashtagModel.schema.index({ userId: 1, hashtag: 1 }, { unique: true });

// Índice para búsqueda rápida de hashtags seguidos por usuario
FollowHashtagModel.schema.index({ userId: 1 });

