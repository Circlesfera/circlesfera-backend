import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { HashtagRepository } from '../repositories/hashtag.repository.js';
import { MongoHashtagRepository } from '../repositories/hashtag.repository.js';
import type { FollowHashtagRepository } from '../repositories/follow-hashtag.repository.js';
import { MongoFollowHashtagRepository } from '../repositories/follow-hashtag.repository.js';
import { FeedService } from '../services/feed.service.js';

const hashtagRepository: HashtagRepository = new MongoHashtagRepository();
const followHashtagRepository: FollowHashtagRepository = new MongoFollowHashtagRepository();
const feedService = new FeedService();

export const hashtagRouter = Router();

const hashtagQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20)
});

// GET /hashtags/trending - Obtener hashtags trending
hashtagRouter.get('/trending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const limit = z.coerce.number().int().positive().max(50).optional().parse(req.query.limit) ?? 20;
    const hashtags = await hashtagRepository.findTrending(limit);

    res.status(200).json({ hashtags });
  } catch (error) {
    next(error);
  }
});

// GET /hashtags/search - Buscar hashtags
hashtagRouter.get('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = z.object({ q: z.string().min(1).max(100) }).parse(req.query);
    const limit = z.coerce.number().int().positive().max(50).optional().parse(req.query.limit) ?? 20;

    const hashtags = await hashtagRepository.searchTags(query.q, limit);
    res.status(200).json({ hashtags });
  } catch (error) {
    next(error);
  }
});

// GET /hashtags/following - Obtener hashtags que sigues (DEBE IR ANTES de /:tag)
hashtagRouter.get('/following', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const limit = z.coerce.number().int().positive().max(100).optional().parse(req.query.limit) ?? 50;

    const followedTags = await followHashtagRepository.findFollowedTags(req.auth.userId);
    const limitedTags = followedTags.slice(0, limit);

    // Obtener información completa de cada hashtag
    const hashtagsData = await Promise.all(
      limitedTags.map(async (tag) => {
        const hashtag = await hashtagRepository.findByTag(tag);
        return hashtag
          ? {
              tag: hashtag.tag,
              postCount: hashtag.postCount,
              lastUsedAt: hashtag.lastUsedAt,
              createdAt: hashtag.createdAt
            }
          : null;
      })
    );

    const hashtags = hashtagsData.filter((h): h is NonNullable<typeof h> => h !== null);

    res.status(200).json({
      hashtags,
      count: followedTags.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /hashtags/:tag/follow - Verificar si sigues un hashtag
hashtagRouter.get('/:tag/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const tag = req.params.tag.replace(/^#/, '').toLowerCase().trim();
    const isFollowing = await followHashtagRepository.exists(req.auth.userId, tag);

    res.status(200).json({
      followed: isFollowing,
      hashtag: tag
    });
  } catch (error) {
    next(error);
  }
});

// GET /hashtags/:tag/posts - Obtener posts de un hashtag específico
hashtagRouter.get('/:tag/posts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const tag = req.params.tag.replace(/^#/, ''); // Remover # si está presente
    const query = hashtagQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;

    const result = await feedService.getHashtagFeed(req.auth.userId, tag, query.limit, cursorDate);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// POST /hashtags/:tag/follow - Seguir un hashtag
hashtagRouter.post('/:tag/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const tag = req.params.tag.replace(/^#/, '').toLowerCase().trim();

    if (tag.length === 0) {
      return next(
        new ApplicationError('Hashtag inválido', {
          statusCode: 400,
          code: 'INVALID_HASHTAG'
        })
      );
    }

    // Verificar que el hashtag existe (o crearlo si no existe)
    const hashtag = await hashtagRepository.findByTag(tag);
    if (!hashtag) {
      // Crear el hashtag si no existe
      await hashtagRepository.createOrUpdate([tag]);
    }

    const follow = await followHashtagRepository.create(req.auth.userId, tag);

    res.status(201).json({
      followed: true,
      hashtag: tag,
      followId: follow.id
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /hashtags/:tag/follow - Dejar de seguir un hashtag
hashtagRouter.delete('/:tag/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const tag = req.params.tag.replace(/^#/, '').toLowerCase().trim();

    await followHashtagRepository.delete(req.auth.userId, tag);

    res.status(200).json({
      followed: false,
      hashtag: tag
    });
  } catch (error) {
    next(error);
  }
});

