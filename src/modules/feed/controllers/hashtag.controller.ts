import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import type { HashtagRepository } from '../repositories/hashtag.repository.js';
import { MongoHashtagRepository } from '../repositories/hashtag.repository.js';
import { FeedService } from '../services/feed.service.js';

const hashtagRepository: HashtagRepository = new MongoHashtagRepository();
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

