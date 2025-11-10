import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { FrameRepository, FrameEntity } from '@modules/frames/repositories/frame.repository.js';
import { MongoFrameRepository } from '@modules/frames/repositories/frame.repository.js';
import type { PostRepository, PostEntity } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import type { SaveRepository } from '../repositories/save.repository.js';
import { MongoSaveRepository } from '../repositories/save.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { LikeRepository } from '../repositories/like.repository.js';
import { MongoLikeRepository } from '../repositories/like.repository.js';
import type { User } from '@modules/users/models/user.model.js';

const saveRepository: SaveRepository = new MongoSaveRepository();
const postRepository: PostRepository = new MongoPostRepository();
const frameRepository: FrameRepository = new MongoFrameRepository();
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

type SavedEntityType = 'Post' | 'Frame';

type SavedFeedItem = {
  id: string;
  caption: string;
  media: unknown[];
  stats: {
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    views: number;
  };
  createdAt: string;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
    isVerified: boolean;
  };
  isLikedByViewer: boolean;
  isSavedByViewer: boolean;
  soundTrackUrl?: string;
};
 
 interface SavedQueryContext {
   readonly userId: string;
   readonly limit: number;
   readonly cursorDate?: Date;
   readonly rawCollectionId?: string;
 }
 
interface SavedEntityAdapter<Entity> {
  loadByIds(ids: string[]): Promise<Entity[]>;
  getEntityId(entity: Entity): string;
  getAuthorId(entity: Entity): string;
  toFeedItem(entity: Entity, author: User | undefined, isLiked: boolean, isSaved: boolean): SavedFeedItem;
}

async function resolveSavedRecords(entityType: SavedEntityType, { userId, limit, cursorDate, rawCollectionId }: SavedQueryContext) {
  if (rawCollectionId && rawCollectionId !== 'default') {
    return await saveRepository.findByCollectionId(rawCollectionId, limit, cursorDate, entityType);
  }

  const normalizedCollection = rawCollectionId === 'default' ? undefined : rawCollectionId;
  return await saveRepository.findByUserId(userId, limit, cursorDate, normalizedCollection, entityType);
}

async function mapSavedEntities<Entity>(
  targetIds: string[],
  userId: string,
  adapter: SavedEntityAdapter<Entity>,
  targetModel: SavedEntityType
): Promise<SavedFeedItem[]> {
  if (targetIds.length === 0) {
    return [];
  }

  const entities = await adapter.loadByIds(targetIds);
  if (entities.length === 0) {
    return [];
  }

  const entityMap = new Map(entities.map((entity) => [adapter.getEntityId(entity), entity]));
  const orderedEntities: Entity[] = [];
  for (const id of targetIds) {
    const entity = entityMap.get(id);
    if (entity) {
      orderedEntities.push(entity);
    }
  }

  if (orderedEntities.length === 0) {
    return [];
  }

  const authorIdSet = new Set<string>();
  for (const entity of orderedEntities) {
    authorIdSet.add(adapter.getAuthorId(entity));
  }
  const authors = await userRepository.findManyByIds(Array.from(authorIdSet));
  const authorsMap = new Map(authors.map((user) => [user.id, user]));

  const orderedIds = orderedEntities.map((entity) => adapter.getEntityId(entity));
  const [likedIds, savedIds] = await Promise.all([
    likeRepository.findLikedPostIds(userId, orderedIds, targetModel),
    saveRepository.findSavedPostIds(userId, orderedIds, targetModel)
  ]);

  const likedSet = new Set(likedIds);
  const savedSet = new Set(savedIds);

  return orderedEntities.map((entity) => {
    const id = adapter.getEntityId(entity);
    const author = authorsMap.get(adapter.getAuthorId(entity));
    return adapter.toFeedItem(entity, author, likedSet.has(id), savedSet.has(id));
  });
}

const postAdapter: SavedEntityAdapter<PostEntity> = {
  loadByIds: (ids) => postRepository.findManyByIds(ids),
  getEntityId: (entity) => entity.id,
  getAuthorId: (entity) => entity.authorId,
  toFeedItem: (post, author, isLiked, isSaved) => ({
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
    isLikedByViewer: isLiked,
    isSavedByViewer: isSaved,
    soundTrackUrl: undefined
  })
};

const frameAdapter: SavedEntityAdapter<FrameEntity> = {
  loadByIds: (ids) => frameRepository.findManyByIds(ids),
  getEntityId: (entity) => entity.id,
  getAuthorId: (entity) => entity.authorId,
  toFeedItem: (frame, author, isLiked, isSaved) => ({
    id: frame.id,
    caption: frame.caption,
    media: frame.media.map((media) => ({
      ...media,
      thumbnailUrl: media.thumbnailUrl ?? ''
    })),
    stats: {
      likes: frame.likes,
      comments: frame.comments,
      saves: frame.saves,
      shares: frame.shares,
      views: frame.views
    },
    createdAt: frame.createdAt.toISOString(),
    author: {
      id: author ? author.id : frame.authorId,
      handle: author ? author.handle : 'usuario',
      displayName: author ? author.displayName : 'Usuario desconocido',
      avatarUrl: author?.avatarUrl ?? '',
      isVerified: Boolean((author as { isVerified?: boolean } | undefined)?.isVerified)
    },
    isLikedByViewer: isLiked,
    isSavedByViewer: isSaved,
    soundTrackUrl: undefined
  })
};

const mapSavedPostsToFeedItems = (postIds: string[], userId: string) => mapSavedEntities(postIds, userId, postAdapter, 'Post');
const mapSavedFramesToFeedItems = (frameIds: string[], userId: string) => mapSavedEntities(frameIds, userId, frameAdapter, 'Frame');

async function buildSavedResponse(entityType: SavedEntityType, context: SavedQueryContext): Promise<{ data: SavedFeedItem[]; nextCursor: string | null }> {
  const { items, hasMore } = await resolveSavedRecords(entityType, context);

  if (items.length === 0) {
    return { data: [], nextCursor: null };
  }

  const targetIds = items.map((save) => save.postId);
  const data = entityType === 'Post'
    ? await mapSavedPostsToFeedItems(targetIds, context.userId)
    : await mapSavedFramesToFeedItems(targetIds, context.userId);

  if (data.length === 0) {
    return { data: [], nextCursor: null };
  }

  const dataMap = new Map(data.map((item) => [item.id, item]));
  const ordered = targetIds
    .map((id) => dataMap.get(id))
    .filter((item): item is SavedFeedItem => Boolean(item));

  if (ordered.length === 0) {
    return { data: [], nextCursor: null };
  }

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

  return { data: ordered, nextCursor };
}

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

saveRouter.post('/frames/:frameId/save', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const frameId = req.params.frameId;
    const userId = req.auth.userId;
    const payload = savePostSchema.parse(req.body);

    const frame = await frameRepository.findById(frameId);
    if (!frame) {
      throw new ApplicationError('Frame no encontrado', {
        statusCode: 404,
        code: 'FRAME_NOT_FOUND'
      });
    }

    const alreadySaved = await saveRepository.exists(frameId, userId, 'Frame');
    if (alreadySaved) {
      await saveRepository.updateCollection(frameId, userId, payload.collectionId, 'Frame');
      return res.status(200).json({ message: 'Frame actualizado en colección', saved: true });
    }

    await saveRepository.create(frameId, userId, payload.collectionId, 'Frame');

    res.status(201).json({ message: 'Frame guardado', saved: true });
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

saveRouter.delete('/frames/:frameId/save', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

    await saveRepository.delete(frameId, userId, 'Frame');

    res.status(200).json({ message: 'Frame desguardado', saved: false });
  } catch (error) {
    next(error);
  }
});

saveRouter.get('/frames', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.auth.userId;
    const query = savedPostsQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
    const response = await buildSavedResponse('Frame', {
      userId,
      limit: query.limit,
      cursorDate,
      rawCollectionId: query.collectionId
    });

    res.status(200).json(response);
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
    const response = await buildSavedResponse('Post', {
      userId,
      limit: query.limit,
      cursorDate,
      rawCollectionId: query.collectionId
    });

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

