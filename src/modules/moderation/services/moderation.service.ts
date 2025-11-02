import { ApplicationError } from '@core/errors/application-error.js';

import type { ReportRepository } from '../repositories/report.repository.js';
import { MongoReportRepository } from '../repositories/report.repository.js';
import type { ReportTargetType, ReportReason } from '../models/report.model.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { CommentRepository } from '@modules/interactions/repositories/comment.repository.js';
import { MongoCommentRepository } from '@modules/interactions/repositories/comment.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export interface ReportEntity {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  createdAt: string;
}

export class ModerationService {
  public constructor(
    private readonly reports: ReportRepository = new MongoReportRepository(),
    private readonly posts: PostRepository = new MongoPostRepository(),
    private readonly comments: CommentRepository = new MongoCommentRepository(),
    private readonly users: UserRepository = new MongoUserRepository()
  ) {}

  public async createReport(reporterId: string, input: CreateReportInput): Promise<ReportEntity> {
    // Verificar que el objetivo existe
    let targetExists = false;
    switch (input.targetType) {
      case 'post':
        const post = await this.posts.findById(input.targetId);
        targetExists = post !== null;
        break;
      case 'comment':
        const comment = await this.comments.findById(input.targetId);
        targetExists = comment !== null;
        break;
      case 'user':
        const user = await this.users.findById(input.targetId);
        targetExists = user !== null;
        break;
    }

    if (!targetExists) {
      throw new ApplicationError('El contenido a reportar no existe', {
        statusCode: 404,
        code: 'TARGET_NOT_FOUND'
      });
    }

    // Verificar que el usuario no se está reportando a sí mismo
    if (input.targetType === 'user' && input.targetId === reporterId) {
      throw new ApplicationError('No puedes reportarte a ti mismo', {
        statusCode: 400,
        code: 'CANNOT_REPORT_SELF'
      });
    }

    const report = await this.reports.create({
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details
    });

    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      createdAt: report.createdAt.toISOString()
    };
  }

  public async getReportCount(targetType: ReportTargetType, targetId: string): Promise<number> {
    return await this.reports.countByTarget(targetType, targetId);
  }
}

