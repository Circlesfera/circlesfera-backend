import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'follows',
    timestamps: true
  }
})
export class Follow {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public followerId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public followingId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const FollowModel: ReturnModelType<typeof Follow> = getModelForClass(Follow);

