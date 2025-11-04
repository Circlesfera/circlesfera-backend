import 'reflect-metadata';

import { ReturnModelType, getModelForClass, modelOptions, prop } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { User } from '@modules/users/models/user.model.js';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

@modelOptions({
  schemaOptions: {
    collection: 'verification_requests',
    timestamps: true
  }
})
export class VerificationRequest {
  public id!: string;

  @prop({ required: true, ref: () => User, type: () => mongoose.Types.ObjectId, index: true })
  public userId!: mongoose.Types.ObjectId;

  @prop({ required: true, type: () => String, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  public status!: VerificationStatus;

  @prop({ type: () => String, trim: true })
  public justification?: string; // Razón por la que solicita verificación

  @prop({ type: () => String, trim: true })
  public documentsUrl?: string; // URL a documentos que prueben identidad

  @prop({ type: () => mongoose.Types.ObjectId, ref: () => User })
  public reviewedBy?: mongoose.Types.ObjectId; // Admin que revisó

  @prop({ type: () => String, trim: true })
  public reviewNotes?: string; // Notas del admin al aprobar/rechazar

  @prop({ type: () => Date })
  public reviewedAt?: Date;

  public createdAt!: Date;

  public updatedAt!: Date;
}

export const VerificationRequestModel: ReturnModelType<typeof VerificationRequest> =
  getModelForClass(VerificationRequest);

// Índice para evitar múltiples solicitudes pendientes del mismo usuario
VerificationRequestModel.schema.index({ userId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

