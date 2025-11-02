import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { VerificationRequestModel, VerificationRequest, VerificationStatus } from '../models/verification-request.model.js';

export interface VerificationRequestEntity {
  id: string;
  userId: string;
  status: VerificationStatus;
  justification?: string;
  documentsUrl?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVerificationRequestInput {
  userId: string;
  justification?: string;
  documentsUrl?: string;
}

export interface UpdateVerificationRequestInput {
  status: VerificationStatus;
  reviewedBy: string;
  reviewNotes?: string;
}

export interface VerificationRequestRepository {
  create(input: CreateVerificationRequestInput): Promise<VerificationRequestEntity>;
  findById(id: string): Promise<VerificationRequestEntity | null>;
  findByUserId(userId: string): Promise<VerificationRequestEntity | null>;
  findPendingRequests(limit?: number, cursor?: Date): Promise<VerificationRequestEntity[]>;
  update(id: string, input: UpdateVerificationRequestInput): Promise<VerificationRequestEntity>;
  findByStatus(status: VerificationStatus, limit?: number): Promise<VerificationRequestEntity[]>;
}

const toDomainVerificationRequest = (
  doc: DocumentType<VerificationRequest>
): VerificationRequestEntity => {
  const plain = doc.toObject<VerificationRequest & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    userId: plain.userId.toString(),
    status: plain.status,
    justification: plain.justification,
    documentsUrl: plain.documentsUrl,
    reviewedBy: plain.reviewedBy?.toString(),
    reviewNotes: plain.reviewNotes,
    reviewedAt: plain.reviewedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoVerificationRequestRepository implements VerificationRequestRepository {
  public async create(input: CreateVerificationRequestInput): Promise<VerificationRequestEntity> {
    const request = await VerificationRequestModel.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      justification: input.justification,
      documentsUrl: input.documentsUrl,
      status: 'pending'
    });

    return toDomainVerificationRequest(request);
  }

  public async findById(id: string): Promise<VerificationRequestEntity | null> {
    const request = await VerificationRequestModel.findById(id).exec();
    return request ? toDomainVerificationRequest(request) : null;
  }

  public async findByUserId(userId: string): Promise<VerificationRequestEntity | null> {
    const request = await VerificationRequestModel.findOne({
      userId: new mongoose.Types.ObjectId(userId)
    })
      .sort({ createdAt: -1 })
      .exec();

    return request ? toDomainVerificationRequest(request) : null;
  }

  public async findPendingRequests(limit = 50, cursor?: Date): Promise<VerificationRequestEntity[]> {
    const query: mongoose.FilterQuery<VerificationRequest> = { status: 'pending' };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const requests = await VerificationRequestModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return requests.map((request) => toDomainVerificationRequest(request));
  }

  public async update(id: string, input: UpdateVerificationRequestInput): Promise<VerificationRequestEntity> {
    const updateData: Partial<VerificationRequest> = {
      status: input.status,
      reviewedBy: new mongoose.Types.ObjectId(input.reviewedBy),
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes
    };

    const request = await VerificationRequestModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).exec();

    if (!request) {
      throw new Error('Solicitud de verificación no encontrada');
    }

    return toDomainVerificationRequest(request);
  }

  public async findByStatus(status: VerificationStatus, limit = 50): Promise<VerificationRequestEntity[]> {
    const requests = await VerificationRequestModel.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return requests.map((request) => toDomainVerificationRequest(request));
  }
}

