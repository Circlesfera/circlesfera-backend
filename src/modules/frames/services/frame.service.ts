import { randomUUID } from 'node:crypto';

import DOMPurify from 'isomorphic-dompurify';

import { CacheService } from '@infra/cache/cache.service.js';

import type { CreateFramePayload } from '../dtos/create-frame.dto.js';
import type { FrameEntity, FrameRepository } from '../repositories/frame.repository.js';
import { MongoFrameRepository } from '../repositories/frame.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { CachedUserRepository } from '@modules/users/repositories/user.repository.cached.js';
import type { BlockRepository } from '@modules/interactions/repositories/block.repository.js';
import { MongoBlockRepository } from '@modules/interactions/repositories/block.repository.js';
import type { LikeRepository } from '@modules/interactions/repositories/like.repository.js';
import { MongoLikeRepository } from '@modules/interactions/repositories/like.repository.js';
import type { SaveRepository } from '@modules/interactions/repositories/save.repository.js';
import { MongoSaveRepository } from '@modules/interactions/repositories/save.repository.js';
import type { CommentRepository } from '@modules/interactions/repositories/comment.repository.js';
import { MongoCommentRepository } from '@modules/interactions/repositories/comment.repository.js';
import type { MentionRepository } from '@modules/feed/repositories/mention.repository.js';
import { MongoMentionRepository } from '@modules/feed/repositories/mention.repository.js';
import { ApplicationError } from '@core/errors/application-error.js';

export interface FrameAuthor {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
}

export interface FrameMediaView {
  id: string;
  kind: 'video';
  url: string;
  thumbnailUrl: string;
  durationMs: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export interface FrameStatsView {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
}

export interface FrameFeedItem {
  id: string;
  author: FrameAuthor;
  caption: string;
  media: FrameMediaView[];
  stats: FrameStatsView;
  createdAt: string;
  isLikedByViewer: boolean;
  isSavedByViewer: boolean;
}

export interface FrameFeedResult {
  data: FrameFeedItem[];
  nextCursor: string | null;
}

export class FrameService {
  public constructor(
    private readonly frames: FrameRepository = new MongoFrameRepository(),
    private readonly users: UserRepository = new CachedUserRepository(),
    private readonly blocks: BlockRepository = new MongoBlockRepository(),
    private readonly likes: LikeRepository = new MongoLikeRepository(),
    private readonly saves: SaveRepository = new MongoSaveRepository(),
    private readonly comments: CommentRepository = new MongoCommentRepository(),
    private readonly mentions: MentionRepository = new MongoMentionRepository(),
    private readonly cache: CacheService = new CacheService()
  ) {}

  public async createFrame(userId: string, payload: CreateFramePayload): Promise<FrameFeedItem> {
    const sanitizedCaption = this.sanitizeCaption(payload.caption ?? '');

    const media = payload.media.map((item) => ({
      ...item,
      id: randomUUID()
    }));

    const frame = await this.frames.create({
      authorId: userId,
      caption: sanitizedCaption,
      media
    });

    await this.invalidateFrameCache(userId);

    const author = await this.users.findById(userId);
    const authorsMap = new Map<string, FrameAuthor>();
    if (author) {
      authorsMap.set(author.id, {
        id: author.id,
        handle: author.handle,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl ?? '',
        isVerified: Boolean((author as { isVerified?: boolean }).isVerified)
      });
    }

    return await this.mapFrameToFeedItem(frame, authorsMap, userId, false, false);
  }

  public async deleteFrame(frameId: string, userId: string): Promise<void> {
    const frame = await this.frames.findById(frameId);
    if (!frame) {
      throw new ApplicationError('Frame no encontrado', { statusCode: 404, code: 'FRAME_NOT_FOUND' });
    }

    if (frame.authorId !== userId) {
      throw new ApplicationError('No tienes permiso para eliminar este frame', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.frames.deleteById(frameId);
    await this.invalidateFrameCache(userId);
    await this.mentions.deleteByPostId(frameId, 'Frame');
  }

  public async getFramesFeed(userId: string, limit = 20, cursor?: Date): Promise<FrameFeedResult> {
    const blockedUserIdsSet = await this.resolveBlockedUserIds(userId);

    const excludeAuthorIds = Array.from(blockedUserIdsSet);
    const result = await this.frames.findFrames({ limit, cursor, excludeAuthorIds });

    if (result.items.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(result.items.map((item) => item.authorId));
    const frameIds = result.items.map((frame) => frame.id);
    const [likedFrameIds, savedFrameIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, frameIds, 'Frame'),
      this.saves.findSavedPostIds(userId, frameIds, 'Frame')
    ]);

    const likedSet = new Set(likedFrameIds);
    const savedSet = new Set(savedFrameIds);

    const data = await Promise.all(
      result.items.map((frame) =>
        this.mapFrameToFeedItem(frame, authors, userId, likedSet.has(frame.id), savedSet.has(frame.id))
      )
    );

    const lastItem = result.items[result.items.length - 1];
    const nextCursor = result.hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  public async getFramesByAuthorIds(
    authorIds: string[],
    viewerId: string,
    limit = 20,
    cursor?: Date
  ): Promise<{ items: FrameFeedItem[]; hasMore: boolean }> {
    if (authorIds.length === 0) {
      return { items: [], hasMore: false };
    }

    const blockedUserIdsSet = await this.resolveBlockedUserIds(viewerId);

    const excludeAuthorIds = Array.from(blockedUserIdsSet);
    const { items, hasMore } = await this.frames.findByAuthorIds({ authorIds, limit, cursor, excludeAuthorIds });
    const filteredItems = items.filter((frame) => !blockedUserIdsSet.has(frame.authorId));

    if (filteredItems.length === 0) {
      return { items: [], hasMore: false };
    }

    const data = await this.mapFramesToFeedItems(filteredItems, viewerId);
    const hadFiltered = filteredItems.length !== items.length;
    return { items: data, hasMore: hasMore || hadFiltered }; // Si filtramos por bloqueos, podría haber más resultados
  }

  public async getExploreFrames(
    viewerId: string,
    limit = 20,
    cursor?: Date,
    excludeAuthorIds: string[] = []
  ): Promise<{ items: FrameFeedItem[]; hasMore: boolean }> {
    const blockedUserIdsSet = await this.resolveBlockedUserIds(viewerId);

    const combinedExclusions = Array.from(new Set([...excludeAuthorIds, ...blockedUserIdsSet]));
    const { items, hasMore } = await this.frames.findFrames({ limit, cursor, excludeAuthorIds: combinedExclusions });
    const filteredItems = items.filter((frame) => !blockedUserIdsSet.has(frame.authorId));

    if (filteredItems.length === 0) {
      return { items: [], hasMore: false };
    }

    const data = await this.mapFramesToFeedItems(filteredItems, viewerId);
    const hadFiltered = filteredItems.length !== items.length;
    return { items: data, hasMore: hasMore || hadFiltered };
  }

  private async mapFramesToFeedItems(frames: FrameEntity[], viewerId: string): Promise<FrameFeedItem[]> {
    const authors = await this.fetchAuthors(frames.map((frame) => frame.authorId));
    const frameIds = frames.map((frame) => frame.id);
    const [likedFrameIds, savedFrameIds] = await Promise.all([
      this.likes.findLikedPostIds(viewerId, frameIds, 'Frame'),
      this.saves.findSavedPostIds(viewerId, frameIds, 'Frame')
    ]);
    const likedSet = new Set(likedFrameIds);
    const savedSet = new Set(savedFrameIds);

    return Promise.all(
      frames.map((frame) =>
        this.mapFrameToFeedItem(frame, authors, viewerId, likedSet.has(frame.id), savedSet.has(frame.id))
      )
    );
  }

  public async getFrameById(frameId: string, userId: string): Promise<FrameFeedItem | null> {
    const frame = await this.frames.findById(frameId);

    if (!frame || frame.isDeleted) {
      return null;
    }

    const { user1BlocksUser2, user2BlocksUser1 } = await this.blocks.findMutualBlocks(userId, frame.authorId);
    if (user1BlocksUser2 || user2BlocksUser1) {
      return null;
    }

    const authors = await this.fetchAuthors([frame.authorId]);
    const [isLiked, isSaved] = await Promise.all([
      this.likes.exists(frame.id, userId, 'Frame'),
      this.saves.exists(frame.id, userId, 'Frame')
    ]);

    return await this.mapFrameToFeedItem(frame, authors, userId, isLiked, isSaved);
  }

  private async mapFrameToFeedItem(
    frame: FrameEntity,
    authors: Map<string, FrameAuthor>,
    viewerId: string,
    isLiked = false,
    isSaved = false
  ): Promise<FrameFeedItem> {
    const author = authors.get(frame.authorId);

    const [realLikes, realComments, realSaves] = await Promise.all([
      this.likes.countByPostId(frame.id, 'Frame'),
      this.comments.countByPostId(frame.id, 'Frame'),
      this.saves.countByPostId(frame.id, 'Frame')
    ]);

    return {
      id: frame.id,
      caption: frame.caption,
      media: frame.media.map((media) => ({
        ...media,
        thumbnailUrl: media.thumbnailUrl ?? ''
      })),
      stats: {
        likes: realLikes,
        comments: realComments,
        saves: realSaves,
        shares: frame.shares,
        views: frame.views
      },
      author: author ?? {
        id: frame.authorId,
        handle: 'usuario',
        displayName: 'Usuario desconocido',
        avatarUrl: '',
        isVerified: false
      },
      createdAt: frame.createdAt.toISOString(),
      isLikedByViewer: isLiked,
      isSavedByViewer: isSaved
    };
  }

  private async fetchAuthors(authorIds: string[]): Promise<Map<string, FrameAuthor>> {
    const uniqueIds = Array.from(new Set(authorIds));
    const users = await this.users.findManyByIds(uniqueIds);
    const map = new Map<string, FrameAuthor>();

    for (const user of users) {
      map.set(user.id, {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? '',
        isVerified: Boolean((user as { isVerified?: boolean }).isVerified)
      });
    }

    return map;
  }

  private async invalidateFrameCache(userId: string): Promise<void> {
    await Promise.all([
      this.cache.deleteByPattern(`frames:*:${userId}:*`),
      this.cache.deleteByPattern(`feed:home:${userId}:*`)
    ]);
  }

  private sanitizeCaption(caption: string): string {
    return DOMPurify.sanitize(caption, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  }

  private async resolveBlockedUserIds(viewerId: string): Promise<Set<string>> {
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(viewerId),
      this.blocks.findBlockerIds(viewerId)
    ]);
    return new Set([...blockedIds, ...blockerIds]);
  }
}
