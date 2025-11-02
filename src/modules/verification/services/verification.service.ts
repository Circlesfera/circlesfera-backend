import type { VerificationRequestRepository } from '../repositories/verification-request.repository.js';
import { MongoVerificationRequestRepository } from '../repositories/verification-request.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import { ApplicationError } from '@core/errors/application-error.js';

export interface CreateVerificationRequestPayload {
  justification?: string;
  documentsUrl?: string;
}

export interface VerificationRequestItem {
  id: string;
  userId: string;
  userHandle: string;
  userDisplayName: string;
  status: 'pending' | 'approved' | 'rejected';
  justification?: string;
  documentsUrl?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface ReviewVerificationPayload {
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}

export class VerificationService {
  public constructor(
    private readonly requests: VerificationRequestRepository = new MongoVerificationRequestRepository(),
    private readonly users: UserRepository = new MongoUserRepository()
  ) {}

  public async createRequest(userId: string, payload: CreateVerificationRequestPayload): Promise<VerificationRequestItem> {
    // Verificar que el usuario no tenga una solicitud pendiente
    const existingRequest = await this.requests.findByUserId(userId);
    if (existingRequest && existingRequest.status === 'pending') {
      throw new ApplicationError('Ya tienes una solicitud de verificación pendiente', {
        statusCode: 400,
        code: 'PENDING_REQUEST_EXISTS'
      });
    }

    // Verificar que el usuario no esté ya verificado
    const user = await this.users.findById(userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    if ((user as { isVerified?: boolean }).isVerified) {
      throw new ApplicationError('Tu cuenta ya está verificada', {
        statusCode: 400,
        code: 'ALREADY_VERIFIED'
      });
    }

    const request = await this.requests.create({
      userId,
      justification: payload.justification,
      documentsUrl: payload.documentsUrl
    });

    return this.mapToItem(request, user);
  }

  public async getMyRequest(userId: string): Promise<VerificationRequestItem | null> {
    const request = await this.requests.findByUserId(userId);

    if (!request) {
      return null;
    }

    const user = await this.users.findById(userId);
    if (!user) {
      return null;
    }

    return this.mapToItem(request, user);
  }

  public async getPendingRequests(limit = 50, cursor?: Date): Promise<VerificationRequestItem[]> {
    const requests = await this.requests.findPendingRequests(limit, cursor);

    const userIds = Array.from(new Set(requests.map((r) => r.userId)));
    const usersMap = new Map(
      (await this.users.findManyByIds(userIds)).map((u) => [u.id, u])
    );

    return requests.map((request) => {
      const user = usersMap.get(request.userId);
      return this.mapToItem(request, user);
    });
  }

  public async reviewRequest(
    requestId: string,
    adminId: string,
    payload: ReviewVerificationPayload
  ): Promise<VerificationRequestItem> {
    // Verificar que el admin existe y tiene permisos
    const admin = await this.users.findById(adminId);
    if (!admin) {
      throw new ApplicationError('Admin no encontrado', {
        statusCode: 404,
        code: 'ADMIN_NOT_FOUND'
      });
    }

    if (!(admin as { isAdmin?: boolean }).isAdmin) {
      throw new ApplicationError('No tienes permisos para revisar solicitudes', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    const request = await this.requests.findById(requestId);
    if (!request) {
      throw new ApplicationError('Solicitud de verificación no encontrada', {
        statusCode: 404,
        code: 'REQUEST_NOT_FOUND'
      });
    }

    if (request.status !== 'pending') {
      throw new ApplicationError('Esta solicitud ya fue procesada', {
        statusCode: 400,
        code: 'REQUEST_ALREADY_PROCESSED'
      });
    }

    // Actualizar solicitud
    const updatedRequest = await this.requests.update(requestId, {
      status: payload.status,
      reviewedBy: adminId,
      reviewNotes: payload.reviewNotes
    });

    // Si fue aprobada, marcar usuario como verificado
    if (payload.status === 'approved') {
      await this.users.update(request.userId, { isVerified: true });
    }

    const user = await this.users.findById(request.userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.mapToItem(updatedRequest, user);
  }

  private mapToItem(
    request: {
      id: string;
      userId: string;
      status: 'pending' | 'approved' | 'rejected';
      justification?: string;
      documentsUrl?: string;
      reviewedBy?: string;
      reviewNotes?: string;
      reviewedAt?: Date;
      createdAt: Date;
    },
    user?: { handle: string; displayName: string } | null
  ): VerificationRequestItem {
    return {
      id: request.id,
      userId: request.userId,
      userHandle: user?.handle ?? 'usuario',
      userDisplayName: user?.displayName ?? 'Usuario desconocido',
      status: request.status,
      justification: request.justification,
      documentsUrl: request.documentsUrl,
      reviewedBy: request.reviewedBy,
      reviewNotes: request.reviewNotes,
      reviewedAt: request.reviewedAt?.toISOString(),
      createdAt: request.createdAt.toISOString()
    };
  }
}

