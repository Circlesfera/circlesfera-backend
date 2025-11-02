import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { SaveRepository } from '../repositories/save.repository.js';
import { MongoSaveRepository } from '../repositories/save.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { LikeRepository } from '../repositories/like.repository.js';
import { MongoLikeRepository } from '../repositories/like.repository.js';

const saveRepository: SaveRepository = new MongoSaveRepository();
const postRepository: PostRepository = new MongoPostRepository();
const userRepository: UserRepository = new MongoUserRepository();
const likeRepository: LikeRepository = new MongoLikeRepository();

export const saveRouter = Router();

const savedPostsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  collectionId: z.string().optional()
});

const savePostSchema = z.object({
  collectionId: z.string().optional()
});

saveRouter.post('/posts/:postId/save', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const postId = req.params.postId;
    const userId = req.auth.userId;
    const payload = savePostSchema.parse(req.body);

    const post = await postRepository.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    const alreadySaved = await saveRepository.exists(postId, userId);
    if (alreadySaved) {
      // Si ya está guardado, actualizar la colección
      await saveRepository.updateCollection(postId, userId, payload.collectionId);
      return res.status(200).json({ message: 'Publicación actualizada en colección', saved: true });
    }

    await saveRepository.create(postId, userId, payload.collectionId);

    res.status(201).json({ message: 'Publicación guardada', saved: true });
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

saveRouter.delete('/posts/:postId/save', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

    await saveRepository.delete(postId, userId);

    res.status(200).json({ message: 'Publicación desguardada', saved: false });
  } catch (error) {
    next(error);
  }
});

saveRouter.get('/saved', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.auth.userId;
    const query = savedPostsQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;

    // Si se especifica collectionId, usar findByCollectionId, sino usar findByUserId
    const { items, hasMore } = query.collectionId && query.collectionId !== 'default'
      ? await saveRepository.findByCollectionId(query.collectionId, query.limit, cursorDate)
      : await saveRepository.findByUserId(userId, query.limit, cursorDate, query.collectionId === 'default' ? undefined : query.collectionId);

    if (items.length === 0) {
      return res.status(200).json({ data: [], nextCursor: null });
    }

    const postIds = items.map((save) => save.postId);
    const posts = await Promise.all(postIds.map((postId) => postRepository.findById(postId)));
    const validPosts = posts.filter((post): post is NonNullable<typeof post> => post !== null);

    if (validPosts.length === 0) {
      return res.status(200).json({ data: [], nextCursor: null });
    }

    // Ordenar según el orden de los saves
    const postsMap = new Map(validPosts.map((post) => [post.id, post]));
    const orderedPosts = postIds.map((id) => postsMap.get(id)).filter((post): post is NonNullable<typeof post> => post !== null);

    // Obtener autores y mapear a FeedItem
    const authorIds = Array.from(new Set(orderedPosts.map((post) => post.authorId)));
    const authors = await userRepository.findManyByIds(authorIds);
    const authorsMap = new Map(authors.map((user) => [user.id, user]));

    // Obtener likes y saves del usuario
    const allPostIds = orderedPosts.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      likeRepository.findLikedPostIds(userId, allPostIds),
      saveRepository.findSavedPostIds(userId, allPostIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    // Mapear a FeedItem usando el método privado del FeedService
    // Como es privado, vamos a hacer el mapeo manualmente
    const feedItems = orderedPosts.map((post) => {
      const author = authorsMap.get(post.authorId);
      return {
        id: post.id,
        caption: post.caption,
        media: post.media.map((media) => ({ ...media })),
        stats: post.stats,
        createdAt: post.createdAt.toISOString(),
        author: {
          id: author ? author.id : post.authorId,
          handle: author ? author.handle : 'usuario',
          displayName: author ? author.displayName : 'Usuario desconocido',
          avatarUrl: author?.avatarUrl ?? '',
          isVerified: Boolean((author as { isVerified?: boolean } | undefined)?.isVerified)
        },
        isLikedByViewer: likedPostIdsSet.has(post.id),
        isSavedByViewer: savedPostIdsSet.has(post.id),
        soundTrackUrl: undefined
      };
    });

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    res.status(200).json({ data: feedItems, nextCursor });
  } catch (error) {
    next(error);
  }
});

