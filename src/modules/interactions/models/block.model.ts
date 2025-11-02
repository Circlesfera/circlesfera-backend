import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'blocks',
    timestamps: true
  }
})
export class Block {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public blockerId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public blockedId!: mongoose.Types.ObjectId;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const BlockModel: ReturnModelType<typeof Block> = getModelForClass(Block);

