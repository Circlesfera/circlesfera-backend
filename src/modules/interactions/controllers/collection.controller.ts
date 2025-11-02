import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { CollectionService } from '../services/collection.service.js';

const collectionService = new CollectionService();

export const collectionRouter = Router();

const createCollectionSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional()
});

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional()
});

collectionRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const collections = await collectionService.getUserCollections(req.auth.userId);

    res.status(200).json({ collections });
  } catch (error) {
    next(error);
  }
});

collectionRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createCollectionSchema.parse(req.body);
    const collection = await collectionService.createCollection(req.auth.userId, payload.name, payload.description);

    res.status(201).json({ collection });
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

collectionRouter.patch('/:collectionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const collectionId = req.params.collectionId;
    const payload = updateCollectionSchema.parse(req.body);

    const collection = await collectionService.updateCollection(collectionId, req.auth.userId, payload);

    res.status(200).json({ collection });
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

collectionRouter.delete('/:collectionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const collectionId = req.params.collectionId;

    await collectionService.deleteCollection(collectionId, req.auth.userId);

    res.status(200).json({ message: 'Colección eliminada exitosamente' });
  } catch (error) {
    next(error);
  }
});

