import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { LikeRepository } from '../repositories/like.repository.js';
import { MongoLikeRepository } from '../repositories/like.repository.js';

const likeRepository: LikeRepository = new MongoLikeRepository();
const postRepository: PostRepository = new MongoPostRepository();

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

