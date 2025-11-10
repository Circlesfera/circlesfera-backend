import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { readOperationRateLimiter, sensitiveOperationRateLimiter } from '@interfaces/http/middlewares/rate-limiter.js';
import { FrameService } from '../services/frame.service.js';
import { FrameUploadService } from '../services/frame-upload.service.js';
import { ApplicationError } from '@core/errors/application-error.js';

const frameService = new FrameService();
const frameUploadService = new FrameUploadService();

const uploadsDir = join(tmpdir(), 'circlesfera-frames');
mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ApplicationError('Tipo de archivo no permitido para frames. Solo se admiten videos (mp4, webm, mov).', {
          statusCode: 400,
          code: 'FRAME_INVALID_MIME'
        })
      );
    }
  }
});

export const frameRouter = Router();

const frameFeedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20)
});

frameRouter.post('/', authenticate, sensitiveOperationRateLimiter, upload.single('media'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const file = req.file;
    if (!file) {
      throw new ApplicationError('Debes adjuntar un video para crear un frame', {
        statusCode: 400,
        code: 'FRAME_MEDIA_REQUIRED'
      });
    }

    const caption = typeof req.body.caption === 'string' ? req.body.caption : '';

    const frame = await frameUploadService.createFromUpload(req.auth.userId, file, caption);

    res.status(201).json({ frame });
  } catch (error) {
    next(error);
  }
});

frameRouter.get('/', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = frameFeedQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
    const feed = await frameService.getFramesFeed(req.auth.userId, query.limit, cursorDate);

    res.status(200).json(feed);
  } catch (error) {
    next(error);
  }
});

frameRouter.get('/:id', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const frame = await frameService.getFrameById(req.params.id, req.auth.userId);
    if (!frame) {
      return res.status(404).json({ code: 'FRAME_NOT_FOUND', message: 'Frame no encontrado' });
    }

    res.status(200).json({ frame });
  } catch (error) {
    next(error);
  }
});

frameRouter.delete('/:id', authenticate, sensitiveOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    await frameService.deleteFrame(req.params.id, req.auth.userId);
    res.status(200).json({ message: 'Frame eliminado exitosamente' });
  } catch (error) {
    next(error);
  }
});
