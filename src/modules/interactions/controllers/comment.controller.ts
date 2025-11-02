import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import { NotificationService } from '@modules/notifications/services/notification.service.js';
import type { CommentRepository } from '../repositories/comment.repository.js';
import { MongoCommentRepository } from '../repositories/comment.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';

const commentRepository: CommentRepository = new MongoCommentRepository();
const postRepository: PostRepository = new MongoPostRepository();
const userRepository: UserRepository = new MongoUserRepository();
const notificationService = new NotificationService();

export const commentRouter = Router();

const createCommentSchema = z.object({
  content: z.string().min(1).max(2200),
  parentId: z.string().optional() // Para replies
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

    // Si es un reply, verificar que el comentario padre existe y pertenece al mismo post
    if (payload.parentId) {
      const parentComment = await commentRepository.findById(payload.parentId);
      if (!parentComment || parentComment.postId !== postId) {
        throw new ApplicationError('Comentario padre no encontrado', {
          statusCode: 404,
          code: 'PARENT_COMMENT_NOT_FOUND'
        });
      }
    }

    const comment = await commentRepository.create({
      postId,
      authorId: userId,
      content: payload.content,
      parentId: payload.parentId
    });

    // Solo incrementar contador si es un comentario de primer nivel
    if (!payload.parentId) {
      await postRepository.incrementComments(postId);
    }

    // Generar notificación
    const notificationTargetId = payload.parentId
      ? (await commentRepository.findById(payload.parentId))?.authorId ?? post.authorId.toString()
      : post.authorId.toString();

    await notificationService.createNotification({
      type: payload.parentId ? 'reply' : 'comment',
      actorId: userId,
      userId: notificationTargetId,
      postId: post.id,
      commentId: comment.id
    }).catch((err) => {
      // No fallar si la notificación no se puede crear
      console.error('Error al crear notificación de comentario:', err);
    });

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
              avatarUrl: author.avatarUrl ?? '',
              isVerified: (author as { isVerified?: boolean }).isVerified ?? false
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
              avatarUrl: author.avatarUrl ?? '',
              isVerified: (author as { isVerified?: boolean }).isVerified ?? false
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

// GET /comments/:commentId/replies - Obtener replies de un comentario
commentRouter.get('/comments/:commentId/replies', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const commentId = req.params.commentId;
    const replies = await commentRepository.findRepliesByCommentId(commentId);

    if (replies.length === 0) {
      return res.status(200).json({ data: [] });
    }

    const authorIds = Array.from(new Set(replies.map((reply) => reply.authorId)));
    const authors = await userRepository.findManyByIds(authorIds);
    const authorsMap = new Map(authors.map((user) => [user.id, user]));

    const data = replies.map((reply) => {
      const author = authorsMap.get(reply.authorId);
      return {
        id: reply.id,
        postId: reply.postId,
        parentId: reply.parentId,
        author: author
          ? {
              id: author.id,
              handle: author.handle,
              displayName: author.displayName,
              avatarUrl: author.avatarUrl ?? '',
              isVerified: (author as { isVerified?: boolean }).isVerified ?? false
            }
          : null,
        content: reply.content,
        likes: reply.likes,
        createdAt: reply.createdAt.toISOString(),
        updatedAt: reply.updatedAt.toISOString()
      };
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

