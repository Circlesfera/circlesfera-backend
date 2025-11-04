import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'collections',
    timestamps: true
  }
})
export class Collection {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, trim: true, type: () => String, maxlength: 50 })
  public name!: string;

  @prop({ trim: true, type: () => String, maxlength: 200 })
  public description?: string;

  @prop({ type: () => Boolean, default: false })
  public isDefault!: boolean; // Colección por defecto (sin nombre, "Guardados")

  @prop({ type: () => Number, default: 0 })
  public postCount!: number;

  @prop({ type: () => String, trim: true })
  public coverImageUrl?: string; // URL de la primera imagen del primer post

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const CollectionModel: ReturnModelType<typeof Collection> = getModelForClass(Collection);

// Índice compuesto para evitar colecciones duplicadas con el mismo nombre por usuario
CollectionModel.schema.index({ userId: 1, name: 1 }, { unique: true });

