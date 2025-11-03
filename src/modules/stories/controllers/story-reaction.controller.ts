import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { ApplicationError } from '@core/errors/application-error.js';
import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { StoryReactionService } from '../services/story-reaction.service.js';
import { ALLOWED_REACTION_EMOJIS } from '../models/story-reaction.model.js';

const storyReactionService = new StoryReactionService();

const reactToStorySchema = z.object({
  emoji: z.enum(ALLOWED_REACTION_EMOJIS as [string, ...string[]])
});

export const storyReactionRouter = Router();

/**
 * POST /stories/:storyId/reactions
 * Crea o actualiza una reacción a una story.
 */
storyReactionRouter.post('/stories/:storyId/reactions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    const payload = reactToStorySchema.parse(req.body);

    try {
      const reaction = await storyReactionService.reactToStory(storyId, req.auth.userId, payload.emoji);
      res.status(201).json({ reaction });
    } catch (error) {
      // Si la reacción fue eliminada (toggle), retornar 200
      if (error instanceof ApplicationError && error.code === 'REACTION_REMOVED') {
        return res.status(200).json({ message: 'Reacción eliminada' });
      }
      throw error;
    }
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
 * GET /stories/:storyId/reactions
 * Obtiene todas las reacciones de una story.
 */
storyReactionRouter.get('/stories/:storyId/reactions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    const result = await storyReactionService.getStoryReactions(storyId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stories/:storyId/reactions/me
 * Obtiene la reacción del usuario actual a una story.
 */
storyReactionRouter.get('/stories/:storyId/reactions/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    const emoji = await storyReactionService.getUserReaction(storyId, req.auth.userId);

    res.status(200).json({ emoji });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /stories/:storyId/reactions
 * Elimina la reacción del usuario actual a una story.
 */
storyReactionRouter.delete('/stories/:storyId/reactions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const storyId = req.params.storyId;
    await storyReactionService.removeReaction(storyId, req.auth.userId);

    res.status(200).json({ message: 'Reacción eliminada' });
  } catch (error) {
    next(error);
  }
});

