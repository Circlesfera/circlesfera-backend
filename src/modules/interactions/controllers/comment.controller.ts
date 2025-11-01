import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { CommentRepository } from '../repositories/comment.repository.js';
import { MongoCommentRepository } from '../repositories/comment.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';

const commentRepository: CommentRepository = new MongoCommentRepository();
const postRepository: PostRepository = new MongoPostRepository();
const userRepository: UserRepository = new MongoUserRepository();

export const commentRouter = Router();

const createCommentSchema = z.object({
  content: z.string().min(1).max(2200)
});

const commentQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

commentRouter.post('/posts/:postId/comments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

    const payload = createCommentSchema.parse(req.body);
    const comment = await commentRepository.create({
      postId,
      authorId: userId,
      content: payload.content
    });

    await postRepository.incrementComments(postId);

    const author = await userRepository.findById(userId);

    res.status(201).json({
      comment: {
        id: comment.id,
        postId: comment.postId,
        author: author
          ? {
              id: author.id,
              handle: author.handle,
              displayName: author.displayName,
              avatarUrl: author.avatarUrl ?? ''
            }
          : null,
        content: comment.content,
        likes: comment.likes,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

commentRouter.get('/posts/:postId/comments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const query = commentQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;

    const { items, hasMore } = await commentRepository.findByPostId({
      postId,
      limit: query.limit,
      cursor: cursorDate
    });

    if (items.length === 0) {
      return res.status(200).json({
        data: [],
        nextCursor: null
      });
    }

    const authorIds = Array.from(new Set(items.map((comment) => comment.authorId)));
    const authors = await userRepository.findManyByIds(authorIds);
    const authorsMap = new Map(authors.map((user) => [user.id, user]));

    const data = items.map((comment) => {
      const author = authorsMap.get(comment.authorId);
      return {
        id: comment.id,
        postId: comment.postId,
        author: author
          ? {
              id: author.id,
              handle: author.handle,
              displayName: author.displayName,
              avatarUrl: author.avatarUrl ?? ''
            }
          : null,
        content: comment.content,
        likes: comment.likes,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString()
      };
    });

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    res.status(200).json({ data, nextCursor });
  } catch (error) {
    next(error);
  }
});

