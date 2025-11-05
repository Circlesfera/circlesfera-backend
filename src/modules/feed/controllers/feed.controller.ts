import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { sensitiveOperationRateLimiter, readOperationRateLimiter } from '@interfaces/http/middlewares/rate-limiter.js';
import { ApplicationError } from '@core/errors/application-error.js';

import { createPostSchema } from '../dtos/create-post.dto.js';
import { updatePostSchema } from '../dtos/update-post.dto.js';
import { homeFeedQuerySchema } from '../dtos/home-feed.dto.js';
import { FeedService } from '../services/feed.service.js';
import { MediaService } from '@modules/media/services/media.service.js';

const feedService = new FeedService();
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

export const feedRouter = Router();

/**
 * @swagger
 * /feed:
 *   get:
 *     tags: [Feed]
 *     summary: Obtener feed principal del usuario
 *     description: Devuelve el feed personalizado del usuario con posts de usuarios seguidos y hashtags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Número de posts a devolver
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Cursor para paginación
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recent, relevance]
 *           default: recent
 *         description: Orden de los posts
 *     responses:
 *       200:
 *         description: Feed obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
feedRouter.get('/', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
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

feedRouter.get('/explore', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = homeFeedQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
    const feed = await feedService.getExploreFeed(req.auth.userId, query.limit, cursorDate);

    res.status(200).json(feed);
  } catch (error) {
    next(error);
  }
});

feedRouter.get('/reels', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = homeFeedQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
    const feed = await feedService.getReelsFeed(req.auth.userId, query.limit, cursorDate);

    res.status(200).json(feed);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /feed/archived
 * Obtiene los posts archivados del usuario autenticado.
 * IMPORTANTE: Debe ir antes de /:id para evitar que "archived" sea capturado como id
 */
feedRouter.get('/archived', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = homeFeedQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
    const result = await feedService.getArchivedPosts(req.auth.userId, query.limit, cursorDate);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

feedRouter.get('/:id', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.id;
    const post = await feedService.getPostById(postId, req.auth.userId);

    if (!post) {
      return res.status(404).json({ code: 'POST_NOT_FOUND', message: 'Publicación no encontrada' });
    }

    res.status(200).json({ post });
  } catch (error) {
    next(error);
  }
});

feedRouter.get('/:id/related', authenticate, readOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.id;
    const limitParam = req.query.limit ? Number(req.query.limit) : 6;
    const limit = Math.min(Math.max(1, limitParam), 12); // Entre 1 y 12
    const relatedPosts = await feedService.getRelatedPosts(postId, req.auth.userId, limit);

    res.status(200).json({ posts: relatedPosts });
  } catch (error) {
    next(error);
  }
});

feedRouter.get('/mentions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = homeFeedQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
    const feed = await feedService.getMentionsFeed(req.auth.userId, query.limit, cursorDate);

    res.status(200).json(feed);
  } catch (error) {
    next(error);
  }
});

feedRouter.get('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const query = typeof req.query.q === 'string' ? req.query.q : '';
    if (query.trim().length < 2) {
      return res.status(400).json({ code: 'INVALID_QUERY', message: 'La búsqueda debe tener al menos 2 caracteres' });
    }

    const limitParam = req.query.limit ? Number(req.query.limit) : 20;
    const limit = Math.min(Math.max(1, limitParam), 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : undefined;

    const result = await feedService.searchPosts(query, req.auth.userId, limit, cursor);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

feedRouter.post('/', authenticate, sensitiveOperationRateLimiter, upload.array('media', 10), async (req: Request, res: Response, next: NextFunction) => {
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
          thumbnailUrl: uploadResult.thumbnailUrl,
          durationMs: uploadResult.durationMs,
          width: uploadResult.width,
          height: uploadResult.height
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

/**
 * PATCH /feed/:id
 * Edita el caption de un post (solo el autor).
 */
feedRouter.patch('/:id', authenticate, sensitiveOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.id;
    const payload = updatePostSchema.parse(req.body);
    const updatedPost = await feedService.updatePost(postId, req.auth.userId, payload);

    res.status(200).json({ post: updatedPost });
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
 * DELETE /feed/:id
 * Elimina un post (soft delete, solo el autor).
 */
feedRouter.delete('/:id', authenticate, sensitiveOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.id;
    await feedService.deletePost(postId, req.auth.userId);

    res.status(200).json({ message: 'Publicación eliminada exitosamente' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /feed/:id/archive
 * Archiva un post (oculta del perfil, solo el autor).
 */
feedRouter.post('/:id/archive', authenticate, sensitiveOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.id;
    await feedService.archivePost(postId, req.auth.userId);

    res.status(200).json({ message: 'Publicación archivada exitosamente' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /feed/:id/archive
 * Desarchiva un post (solo el autor).
 */
feedRouter.delete('/:id/archive', authenticate, sensitiveOperationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.id;
    await feedService.unarchivePost(postId, req.auth.userId);

    res.status(200).json({ message: 'Publicación desarchivada exitosamente' });
  } catch (error) {
    next(error);
  }
});

