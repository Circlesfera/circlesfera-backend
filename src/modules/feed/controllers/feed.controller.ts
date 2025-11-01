import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';

import { createPostSchema } from '../dtos/create-post.dto.js';
import { homeFeedQuerySchema } from '../dtos/home-feed.dto.js';
import { FeedService } from '../services/feed.service.js';
import { MediaService } from '@modules/media/services/media.service.js';

const feedService = new FeedService();
const mediaService = new MediaService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApplicationError('Tipo de archivo no permitido', { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
    }
  }
});

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

feedRouter.post('/', authenticate, upload.array('media', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const files = req.files as Express.Multer.File[];
    const caption = typeof req.body.caption === 'string' ? req.body.caption : '';

    const uploadedMedia = await Promise.all(
      files.map(async (file) => {
        const uploadResult = await mediaService.uploadMedia(file.buffer, file.mimetype, req.auth!.userId);
        const kind = mediaService.getMediaKind(file.mimetype);

        return {
          id: randomUUID(),
          kind,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl
        };
      })
    );

    const payload = createPostSchema.parse({ caption, media: uploadedMedia });
    const item = await feedService.createPost(req.auth.userId, payload);

    res.status(201).json({ post: item });
  } catch (error) {
    next(error);
  }
});


