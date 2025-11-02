import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { ApplicationError } from '@core/errors/application-error.js';
import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ModerationService } from '../services/moderation.service.js';

const moderationService = new ModerationService();

const createReportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().min(1),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'violence', 'copyright', 'false_information', 'other']),
  details: z.string().max(500).optional()
});

export const moderationRouter = Router();

/**
 * POST /reports
 * Crea un reporte de contenido o usuario.
 */
moderationRouter.post('/reports', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createReportSchema.parse(req.body);
    const report = await moderationService.createReport(req.auth.userId, payload);

    res.status(201).json({ report });
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

