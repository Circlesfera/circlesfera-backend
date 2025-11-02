import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import { AnalyticsService } from '../services/analytics.service.js';

const analyticsService = new AnalyticsService();
const postRepository: PostRepository = new MongoPostRepository();

export const analyticsRouter = Router();

const analyticsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

/**
 * Obtiene analytics del perfil del usuario autenticado.
 */
analyticsRouter.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = analyticsQuerySchema.parse(req.query);
    const analytics = await analyticsService.getProfileAnalytics(req.auth.userId, query.limit);

    res.status(200).json({ analytics });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        new ApplicationError('Parámetros inválidos', {
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
 * Obtiene analytics de un post específico.
 * Solo el autor del post puede ver sus analytics.
 */
analyticsRouter.get('/posts/:postId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const post = await postRepository.findById(postId);

    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    // Verificar que el usuario es el autor del post
    if (post.authorId !== req.auth.userId) {
      throw new ApplicationError('Solo puedes ver analytics de tus propias publicaciones', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    const analytics = await analyticsService.getPostAnalytics(postId);

    if (!analytics) {
      throw new ApplicationError('No se pudieron obtener analytics de la publicación', {
        statusCode: 500,
        code: 'ANALYTICS_ERROR'
      });
    }

    res.status(200).json({ analytics });
  } catch (error) {
    next(error);
  }
});

