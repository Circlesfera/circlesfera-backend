import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { MediaService } from '../services/media.service.js';

const mediaService = new MediaService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApplicationError('Tipo de archivo no permitido', { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
    }
  }
});

export const mediaRouter = Router();

/**
 * POST /media/upload
 * Sube un archivo de media (imagen o video) y devuelve su URL y metadata.
 */
mediaRouter.post('/upload', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    if (!req.file) {
      throw new ApplicationError('No se proporcionó ningún archivo', {
        statusCode: 400,
        code: 'FILE_REQUIRED'
      });
    }

    const result = await mediaService.uploadMedia(req.file.buffer, req.file.mimetype, req.auth.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

