import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { HighlightService } from '../services/highlight.service.js';

const highlightService = new HighlightService();

export const highlightRouter = Router();

const createHighlightSchema = z.object({
  name: z.string().min(1).max(50)
});

const updateHighlightSchema = z.object({
  name: z.string().min(1).max(50).optional()
});

const addStorySchema = z.object({
  storyId: z.string()
});

highlightRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const highlights = await highlightService.getUserHighlights(req.auth.userId);

    res.status(200).json({ highlights });
  } catch (error) {
    next(error);
  }
});

highlightRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createHighlightSchema.parse(req.body);
    const highlight = await highlightService.createHighlight(req.auth.userId, payload.name);

    res.status(201).json({ highlight });
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

highlightRouter.get('/:highlightId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const highlightId = req.params.highlightId;
    const highlight = await highlightService.getHighlightById(highlightId, req.auth.userId);

    if (!highlight) {
      return res.status(404).json({ code: 'HIGHLIGHT_NOT_FOUND', message: 'Highlight no encontrado' });
    }

    res.status(200).json({ highlight });
  } catch (error) {
    next(error);
  }
});

highlightRouter.patch('/:highlightId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const highlightId = req.params.highlightId;
    const payload = updateHighlightSchema.parse(req.body);

    const highlight = await highlightService.updateHighlight(highlightId, req.auth.userId, payload);

    res.status(200).json({ highlight });
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

highlightRouter.delete('/:highlightId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const highlightId = req.params.highlightId;

    await highlightService.deleteHighlight(highlightId, req.auth.userId);

    res.status(200).json({ message: 'Highlight eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
});

highlightRouter.post('/:highlightId/stories', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const highlightId = req.params.highlightId;
    const payload = addStorySchema.parse(req.body);

    await highlightService.addStoryToHighlight(highlightId, req.auth.userId, payload.storyId);

    res.status(200).json({ message: 'Story agregada al highlight exitosamente' });
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

highlightRouter.delete('/:highlightId/stories/:storyId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const highlightId = req.params.highlightId;
    const storyId = req.params.storyId;

    await highlightService.removeStoryFromHighlight(highlightId, req.auth.userId, storyId);

    res.status(200).json({ message: 'Story eliminada del highlight exitosamente' });
  } catch (error) {
    next(error);
  }
});

