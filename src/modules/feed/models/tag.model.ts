import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from './post.model.js';
import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'tags',
    timestamps: true
  }
})
export class Tag {
  public id!: string;

  @prop({ required: true, ref: () => Post, type: () => mongoose.Types.ObjectId, index: true })
  public postId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => Number })
  public mediaIndex!: number; // Índice del media en el array de media del post

  // Coordenadas normalizadas (0-1) o absolutas en píxeles
  @prop({ required: true, type: () => Number })
  public x!: number; // Posición X (0-1 para normalizado, píxeles para absoluto)

  @prop({ required: true, type: () => Number })
  public y!: number; // Posición Y (0-1 para normalizado, píxeles para absoluto)

  @prop({ type: () => Number })
  public width?: number; // Ancho del tag (opcional, para mostrar área clickeable)

  @prop({ type: () => Number })
  public height?: number; // Alto del tag (opcional)

  @prop({ type: () => Boolean, default: false })
  public isNormalized!: boolean; // true si las coordenadas son normalizadas (0-1), false si son píxeles

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const TagModel: ReturnModelType<typeof Tag> = getModelForClass(Tag);

// Índice único para evitar duplicados (un usuario solo puede estar etiquetado una vez en el mismo media)
TagModel.schema.index({ postId: 1, userId: 1, mediaIndex: 1 }, { unique: true });

// Índice para búsqueda rápida de posts donde un usuario está etiquetado
TagModel.schema.index({ userId: 1, createdAt: -1 });

