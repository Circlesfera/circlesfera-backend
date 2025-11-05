import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { MediaService } from '../services/media.service.js';

const mediaService = new MediaService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      // Imágenes
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/heic',
      'image/heif',
      // Videos - tipos MIME comunes que los navegadores pueden enviar
      'video/mp4',
      'video/mp4v-es', // Variante de MP4
      'video/x-m4v', // M4V (MP4 con DRM)
      'video/webm',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/x-matroska', // .mkv
      'video/3gpp', // .3gp
      'video/x-ms-wmv', // .wmv
      'video/mpeg', // .mpeg, .mpg
      'video/ogg', // .ogv
      'video/x-ms-asf', // .asf
      'video/x-flv' // .flv
    ];
    
    // Extraer el tipo MIME base (sin parámetros como codecs)
    const baseMimeType = file.mimetype.toLowerCase().split(';')[0].trim();
    
    if (allowedMimes.includes(baseMimeType)) {
      cb(null, true);
    } else {
      // Incluir el tipo MIME recibido en el mensaje de error
      const errorMessage = `Tipo de archivo no permitido. Tipo recibido: ${file.mimetype} (base: ${baseMimeType}). Tipos permitidos: imágenes (JPEG, PNG, WebP, GIF) o videos (MP4, WebM, MOV, etc.)`;
      cb(new ApplicationError(errorMessage, { 
        statusCode: 400, 
        code: 'INVALID_FILE_TYPE',
        // Agregar metadata adicional para debugging
        metadata: {
          receivedMimeType: file.mimetype,
          baseMimeType,
          filename: file.originalname
        }
      }));
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

