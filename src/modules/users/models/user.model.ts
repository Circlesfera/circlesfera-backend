import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose, { type Document } from 'mongoose';

export interface UserDocument extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  handle: string;
  displayName: string;
  passwordHash: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tipo de dominio para la lógica de negocio (sin _id de MongoDB)
// NOTA: La clase 'User' se exporta más abajo y se usa para referencias TypeGoose (ref: () => User)
// Para tipos de dominio, usar 'UserDomain'
export type UserDomain = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  passwordHash: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@modelOptions({
  schemaOptions: {
    collection: 'users',
    timestamps: true
  }
})
// Clase TypeGoose para MongoDB - debe llamarse User para que las referencias funcionen
export class User {
  public id!: string;

  @prop({ required: true, unique: true, lowercase: true, trim: true, type: () => String })
  public email!: string;

  @prop({ required: true, unique: true, lowercase: true, trim: true, index: true, type: () => String })
  public handle!: string;

  @prop({ required: true, trim: true, type: () => String })
  public displayName!: string;

  @prop({ required: true, select: false, type: () => String })
  public passwordHash!: string;

  @prop({ type: () => String, default: null })
  public bio?: string | null;

  @prop({ type: () => String, default: null })
  public avatarUrl?: string | null;

  @prop({ type: () => Boolean, default: false })
  public isVerified?: boolean;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const UserModel: ReturnModelType<typeof User> = getModelForClass(User);

// Middleware para lowercase en save
UserModel.schema.pre('save', function handleLowercase() {
  if (this.isModified('email')) {
  this.email = this.email.toLowerCase();
  }
  if (this.isModified('handle')) {
  this.handle = this.handle.toLowerCase();
  }
});
