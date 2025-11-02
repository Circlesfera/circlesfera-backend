import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { StoryService } from '../services/story.service.js';
import { createStorySchema } from '../dtos/create-story.dto.js';

const storyService = new StoryService();

export const storyRouter = Router();

storyRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createStorySchema.parse(req.body);
    const story = await storyService.createStory(req.auth.userId, payload);

    res.status(201).json({ story });
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

storyRouter.get('/feed', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const groups = await storyService.getStoryFeed(req.auth.userId);

    res.status(200).json({ groups });
  } catch (error) {
    next(error);
  }
});

storyRouter.get('/user/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.params.userId;
    const stories = await storyService.getUserStories(userId, req.auth.userId);

    res.status(200).json({ stories });
  } catch (error) {
    next(error);
  }
});

storyRouter.get('/:storyId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    const story = await storyService.getStoryById(storyId, req.auth.userId);

    if (!story) {
      throw new ApplicationError('Story no encontrada o expirada', {
        statusCode: 404,
        code: 'STORY_NOT_FOUND'
      });
    }

    res.status(200).json({ story });
  } catch (error) {
    next(error);
  }
});

storyRouter.post('/:storyId/view', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    await storyService.viewStory(storyId, req.auth.userId);

    res.status(200).json({ message: 'Story marcada como vista' });
  } catch (error) {
    next(error);
  }
});

storyRouter.get('/:storyId/viewers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    const limit = z.coerce.number().int().positive().max(100).optional().parse(req.query.limit) ?? 50;

    const viewers = await storyService.getStoryViewers(storyId, req.auth.userId, limit);

    res.status(200).json({
      viewers,
      count: viewers.length
    });
  } catch (error) {
    next(error);
  }
});

