import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';

import { createPostSchema } from '../dtos/create-post.dto.js';
import { homeFeedQuerySchema } from '../dtos/home-feed.dto.js';
import { FeedService } from '../services/feed.service.js';

const feedService = new FeedService();

export const feedRouter = Router();

feedRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = homeFeedQuerySchema.parse(req.query);
    const feed = await feedService.getHomeFeed(req.auth.userId, query);

    res.status(200).json(feed);
  } catch (error) {
    next(error);
  }
});

feedRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createPostSchema.parse(req.body);
    const item = await feedService.createPost(req.auth.userId, payload);

    res.status(201).json({ post: item });
  } catch (error) {
    next(error);
  }
});


