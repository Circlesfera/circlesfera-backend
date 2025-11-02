import type { DocumentType } from '@typegoose/typegoose';
import mongoose from 'mongoose';

import { Report, ReportModel, type ReportTargetType, type ReportReason } from '../models/report.model.js';

export interface ReportEntity {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportInput {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export interface ReportRepository {
  create(data: CreateReportInput): Promise<ReportEntity>;
  findByReporterAndTarget(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<ReportEntity | null>;
  countByTarget(targetType: ReportTargetType, targetId: string): Promise<number>;
  findByStatus(status: 'pending' | 'reviewed' | 'resolved' | 'dismissed', limit?: number): Promise<ReportEntity[]>;
}

const toDomainReport = (doc: DocumentType<Report>): ReportEntity => {
  const plain = doc.toObject<Report & { _id: mongoose.Types.ObjectId }>();

  return {
    id: plain._id.toString(),
    reporterId: plain.reporterId.toString(),
    targetType: plain.targetType,
    targetId: plain.targetId.toString(),
    reason: plain.reason,
    details: plain.details,
    status: plain.status,
    reviewedBy: plain.reviewedBy?.toString(),
    reviewedAt: plain.reviewedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

export class MongoReportRepository implements ReportRepository {
  public async create(data: CreateReportInput): Promise<ReportEntity> {
    // Verificar si ya existe un reporte del mismo usuario para el mismo objetivo
    const existing = await ReportModel.findOne({
      reporterId: new mongoose.Types.ObjectId(data.reporterId),
      targetType: data.targetType,
      targetId: new mongoose.Types.ObjectId(data.targetId)
    }).exec();

    if (existing) {
      // Si ya existe y está pendiente, no crear duplicado
      if (existing.status === 'pending') {
        return toDomainReport(existing);
      }
    }

    const report = await ReportModel.create({
      reporterId: new mongoose.Types.ObjectId(data.reporterId),
      targetType: data.targetType,
      targetId: new mongoose.Types.ObjectId(data.targetId),
      reason: data.reason,
      details: data.details
    });

    return toDomainReport(report);
  }

  public async findByReporterAndTarget(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string
  ): Promise<ReportEntity | null> {
    const report = await ReportModel.findOne({
      reporterId: new mongoose.Types.ObjectId(reporterId),
      targetType,
      targetId: new mongoose.Types.ObjectId(targetId)
    }).exec();

    return report ? toDomainReport(report) : null;
  }

  public async countByTarget(targetType: ReportTargetType, targetId: string): Promise<number> {
    return await ReportModel.countDocuments({
      targetType,
      targetId: new mongoose.Types.ObjectId(targetId),
      status: 'pending'
    }).exec();
  }

  public async findByStatus(
    status: 'pending' | 'reviewed' | 'resolved' | 'dismissed',
    limit = 50
  ): Promise<ReportEntity[]> {
    const reports = await ReportModel.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return reports.map((report) => toDomainReport(report));
  }
}

