import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { VerificationService } from '../services/verification.service.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';

const verificationService = new VerificationService();
const userRepository = new MongoUserRepository();

export const verificationRouter = Router();

const createRequestSchema = z.object({
  justification: z.string().max(500).optional(),
  documentsUrl: z.string().url().optional()
});

const reviewRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().max(500).optional()
});

const pendingRequestsQuerySchema = z.object({
  limit: z.string().optional().transform(Number).pipe(z.number().int().min(1).max(100).optional()),
  cursor: z.string().datetime().optional()
});

// Middleware para verificar si el usuario es admin
const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    return;
  }

  const user = await userRepository.findById(req.auth.userId);
  if (!user || !(user as { isAdmin?: boolean }).isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'No tienes permisos de administrador' });
    return;
  }

  next();
};

/**
 * POST /verification/request
 * Crea una solicitud de verificación
 */
verificationRouter.post('/request', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createRequestSchema.parse(req.body);
    const request = await verificationService.createRequest(req.auth.userId, payload);

    res.status(201).json({ request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        new ApplicationError('Datos inválidos', {
          statusCode: 400,
          code: 'INVALID_INPUT',
          metadata: { errors: error.errors }
        })
      );
    }
    next(error);
  }
});

/**
 * GET /verification/request
 * Obtiene la solicitud de verificación del usuario autenticado
 */
verificationRouter.get('/request', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const request = await verificationService.getMyRequest(req.auth.userId);

    if (!request) {
      return res.status(404).json({ code: 'REQUEST_NOT_FOUND', message: 'No tienes solicitudes de verificación' });
    }

    res.status(200).json({ request });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /verification/pending
 * Obtiene solicitudes pendientes (solo admins)
 */
verificationRouter.get('/pending', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = pendingRequestsQuerySchema.parse(req.query);
    const cursor = query.cursor ? new Date(query.cursor) : undefined;

    const requests = await verificationService.getPendingRequests(query.limit, cursor);

    res.status(200).json({ requests });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        new ApplicationError('Datos inválidos', {
          statusCode: 400,
          code: 'INVALID_INPUT',
          metadata: { errors: error.errors }
        })
      );
    }
    next(error);
  }
});

/**
 * POST /verification/:requestId/review
 * Revisa una solicitud de verificación (solo admins)
 */
verificationRouter.post('/:requestId/review', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const requestId = req.params.requestId;
    const payload = reviewRequestSchema.parse(req.body);

    const request = await verificationService.reviewRequest(requestId, req.auth.userId, payload);

    res.status(200).json({ request });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        new ApplicationError('Datos inválidos', {
          statusCode: 400,
          code: 'INVALID_INPUT',
          metadata: { errors: error.errors }
        })
      );
    }
    next(error);
  }
});

