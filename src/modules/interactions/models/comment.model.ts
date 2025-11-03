import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Post } from '@modules/feed/models/post.model.js';
import { User } from '@modules/users/models/user.model.js';

@modelOptions({
  schemaOptions: {
    collection: 'comments',
    timestamps: true
  }
})
export class Comment {
  public id!: string;

  @prop({ required: true, ref: () => Post, type: () => mongoose.Types.ObjectId, index: true })
  public postId!: mongoose.Types.ObjectId;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId })
  public authorId!: mongoose.Types.ObjectId;

  @prop({ ref: () => Comment, type: () => mongoose.Types.ObjectId, index: true })
  public parentId?: mongoose.Types.ObjectId; // Para replies

  @prop({ required: true, trim: true, type: () => String, maxlength: 2200 })
  public content!: string;

  @prop({ type: () => Number, default: 0 })
  public likes!: number;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const CommentModel: ReturnModelType<typeof Comment> = getModelForClass(Comment);

// Índices para optimización de queries de comentarios
CommentModel.schema.index({ postId: 1, createdAt: -1 }); // Listar comentarios de un post ordenados por fecha
CommentModel.schema.index({ authorId: 1, createdAt: -1 }); // Comentarios del usuario
CommentModel.schema.index({ parentId: 1, createdAt: -1 }); // Replies de un comentario

