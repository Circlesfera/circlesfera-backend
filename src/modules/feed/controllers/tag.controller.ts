import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { ApplicationError } from '@core/errors/application-error.js';
import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { TagService } from '../services/tag.service.js';

const tagService = new TagService();

const createTagSchema = z.object({
  userId: z.string().min(1),
  mediaIndex: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  isNormalized: z.boolean().optional().default(false)
});

export const tagRouter = Router();

/**
 * POST /feed/:postId/tags
 * Crea un tag en un post.
 */
tagRouter.post('/feed/:postId/tags', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const payload = createTagSchema.parse(req.body);

    const tag = await tagService.createTag(postId, req.auth.userId, {
      postId,
      userId: payload.userId,
      mediaIndex: payload.mediaIndex,
      x: payload.x,
      y: payload.y,
      width: payload.width,
      height: payload.height,
      isNormalized: payload.isNormalized
    });

    res.status(201).json({ tag });
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
 * GET /feed/:postId/tags
 * Obtiene todos los tags de un post.
 */
tagRouter.get('/feed/:postId/tags', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const tags = await tagService.getTagsByPostId(postId);

    res.status(200).json({ tags });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /feed/tags/:tagId
 * Elimina un tag.
 */
tagRouter.delete('/feed/tags/:tagId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const tagId = req.params.tagId;
    await tagService.deleteTag(tagId, req.auth.userId);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /feed/tagged
 * Obtiene posts donde el usuario está etiquetado.
 */
tagRouter.get('/feed/tagged', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const limitParam = req.query.limit ? Number(req.query.limit) : 20;
    const limit = Math.min(Math.max(1, limitParam), 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : undefined;

    const result = await tagService.getTaggedPosts(req.auth.userId, limit, cursor);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

