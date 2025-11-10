import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { logger } from '@infra/logger/logger.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { FrameRepository } from '@modules/frames/repositories/frame.repository.js';
import { MongoFrameRepository } from '@modules/frames/repositories/frame.repository.js';
import { NotificationService } from '@modules/notifications/services/notification.service.js';
import type { LikeRepository } from '../repositories/like.repository.js';
import { MongoLikeRepository } from '../repositories/like.repository.js';

const likeRepository: LikeRepository = new MongoLikeRepository();
const postRepository: PostRepository = new MongoPostRepository();
const frameRepository: FrameRepository = new MongoFrameRepository();
const notificationService = new NotificationService();

export const likeRouter = Router();

likeRouter.post('/posts/:postId/like', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const userId = req.auth.userId;

    const post = await postRepository.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    const alreadyLiked = await likeRepository.exists(postId, userId);
    if (alreadyLiked) {
      return res.status(200).json({ message: 'Ya has dado like a esta publicación', liked: true });
    }

    await likeRepository.create(postId, userId);
    await postRepository.incrementLikes(postId);

    // Generar notificación para el autor del post
    await notificationService
      .createNotification({
        type: 'like',
        actorId: userId,
        userId: post.authorId.toString(),
        targetModel: 'Post',
        targetId: post.id,
        postId: post.id
      })
      .catch((err) => {
      // No fallar si la notificación no se puede crear
      logger.warn({ err, postId: post.id, actorId: userId, targetUserId: post.authorId.toString() }, 'Error al crear notificación de like');
      });

    res.status(201).json({ message: 'Like añadido', liked: true });
  } catch (error) {
    next(error);
  }
});

likeRouter.delete('/posts/:postId/like', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const userId = req.auth.userId;

    const post = await postRepository.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    await likeRepository.delete(postId, userId);
    await postRepository.decrementLikes(postId);

    res.status(200).json({ message: 'Like eliminado', liked: false });
  } catch (error) {
    next(error);
  }
});

likeRouter.post('/frames/:frameId/like', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const frameId = req.params.frameId;
    const userId = req.auth.userId;

    const frame = await frameRepository.findById(frameId);
    if (!frame) {
      throw new ApplicationError('Frame no encontrado', {
        statusCode: 404,
        code: 'FRAME_NOT_FOUND'
      });
    }

    const alreadyLiked = await likeRepository.exists(frameId, userId, 'Frame');
    if (alreadyLiked) {
      return res.status(200).json({ message: 'Ya has dado like a este frame', liked: true });
    }

    await likeRepository.create(frameId, userId, 'Frame');
    await frameRepository.incrementLikes(frameId);

    await notificationService
      .createNotification({
        type: 'like',
        actorId: userId,
        userId: frame.authorId.toString(),
        targetModel: 'Frame',
        targetId: frame.id
      })
      .catch((err) => {
        logger.warn({ err, frameId: frame.id, actorId: userId, targetUserId: frame.authorId }, 'Error al crear notificación de like para frame');
      });

    res.status(201).json({ message: 'Like añadido', liked: true });
  } catch (error) {
    next(error);
  }
});

likeRouter.delete('/frames/:frameId/like', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const frameId = req.params.frameId;
    const userId = req.auth.userId;

    const frame = await frameRepository.findById(frameId);
    if (!frame) {
      throw new ApplicationError('Frame no encontrado', {
        statusCode: 404,
        code: 'FRAME_NOT_FOUND'
      });
    }

    await likeRepository.delete(frameId, userId, 'Frame');
    await frameRepository.decrementLikes(frameId);

    res.status(200).json({ message: 'Like eliminado', liked: false });
  } catch (error) {
    next(error);
  }
});

