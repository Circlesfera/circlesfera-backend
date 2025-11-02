import { randomUUID } from 'node:crypto';

import type { CreatePostPayload } from '../dtos/create-post.dto.js';
import type { HomeFeedQuery } from '../dtos/home-feed.dto.js';
import type { PostEntity, PostRepository } from '../repositories/post.repository.js';
import { MongoPostRepository } from '../repositories/post.repository.js';
import type { FollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import { MongoFollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import type { LikeRepository } from '@modules/interactions/repositories/like.repository.js';
import { MongoLikeRepository } from '@modules/interactions/repositories/like.repository.js';
import type { SaveRepository } from '@modules/interactions/repositories/save.repository.js';
import { MongoSaveRepository } from '@modules/interactions/repositories/save.repository.js';
import type { User } from '@modules/users/models/user.model.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { HashtagRepository } from '../repositories/hashtag.repository.js';
import { MongoHashtagRepository } from '../repositories/hashtag.repository.js';
import { extractHashtags } from '../utils/hashtag-extractor.js';

export interface FeedUser {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
}

export type FeedMediaKind = 'image' | 'video';

export interface FeedMedia {
  id: string;
  kind: FeedMediaKind;
  url: string;
  thumbnailUrl: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

export interface FeedStats {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
}

export interface FeedItem {
  id: string;
  author: FeedUser;
  caption: string;
  media: FeedMedia[];
  stats: FeedStats;
  createdAt: string;
  isLikedByViewer: boolean;
  isSavedByViewer: boolean;
  soundTrackUrl?: string;
}

export interface FeedCursorResult {
  data: FeedItem[];
  nextCursor: string | null;
}

export class FeedService {
  public constructor(
    private readonly posts: PostRepository = new MongoPostRepository(),
    private readonly users: UserRepository = new MongoUserRepository(),
    private readonly follows: FollowRepository = new MongoFollowRepository(),
    private readonly likes: LikeRepository = new MongoLikeRepository(),
    private readonly saves: SaveRepository = new MongoSaveRepository(),
    private readonly hashtags: HashtagRepository = new MongoHashtagRepository()
  ) {}

  public async createPost(userId: string, payload: CreatePostPayload): Promise<FeedItem> {
    const media = payload.media.map((item) => ({
      id: randomUUID(),
      kind: item.kind,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      durationMs: item.durationMs,
      width: item.width,
      height: item.height
    }));

    // Extraer hashtags del caption
    const extractedHashtags = extractHashtags(payload.caption);

    const post = await this.posts.create({
      authorId: userId,
      caption: payload.caption,
      media,
      hashtags: extractedHashtags
    });

    // Actualizar contadores de hashtags (no bloqueante)
    if (extractedHashtags.length > 0) {
      this.hashtags.createOrUpdate(extractedHashtags).catch((error) => {
        console.error('Error al actualizar hashtags:', error);
      });
    }

    const author = await this.users.findById(userId);
    const authorsMap = new Map<string, User>();
    if (author) {
      authorsMap.set(author.id, author);
    }

    const [isLiked, isSaved] = await Promise.all([
      this.likes.exists(post.id, userId),
      this.saves.exists(post.id, userId)
    ]);
    return this.mapPostToFeedItem(post, authorsMap, userId, isLiked, isSaved);
  }

  public async getHomeFeed(userId: string, params: HomeFeedQuery): Promise<FeedCursorResult> {
    const limit = params.limit ?? 20;
    const cursorDate = params.cursor ? new Date(params.cursor) : undefined;

    const authorIds = await this.resolveRelevantAuthorIds(userId);
    if (!authorIds.includes(userId)) {
      authorIds.push(userId);
    }

    const { items, hasMore } = await this.posts.findFeed({
      authorIds,
      limit,
      cursor: cursorDate
    });

    if (items.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(items);
    const postIds = items.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const viewerId = userId;
    const data = items.map((post) =>
      this.mapPostToFeedItem(
        post,
        authors,
        viewerId,
        likedPostIdsSet.has(post.id),
        savedPostIdsSet.has(post.id)
      )
    );

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  public async getExploreFeed(userId: string, limit = 20, cursor?: Date): Promise<FeedCursorResult> {
    const followingIds = await this.resolveRelevantAuthorIds(userId);

    const { items, hasMore } = await this.posts.findExplore({
      limit,
      cursor,
      excludeAuthorIds: followingIds // Excluir posts de usuarios seguidos
    });

    if (items.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(items);
    const postIds = items.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const data = items.map((post) =>
      this.mapPostToFeedItem(
        post,
        authors,
        userId,
        likedPostIdsSet.has(post.id),
        savedPostIdsSet.has(post.id)
      )
    );

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  public async getHashtagFeed(userId: string, hashtag: string, limit = 20, cursor?: Date): Promise<FeedCursorResult> {
    const { items, hasMore } = await this.posts.findByHashtag({
      hashtag,
      limit,
      cursor
    });

    if (items.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(items);
    const postIds = items.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const data = items.map((post) =>
      this.mapPostToFeedItem(
        post,
        authors,
        userId,
        likedPostIdsSet.has(post.id),
        savedPostIdsSet.has(post.id)
      )
    );

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  private async resolveRelevantAuthorIds(userId: string): Promise<string[]> {
    return await this.follows.findFollowingIds(userId);
  }

  private async fetchAuthors(posts: PostEntity[]): Promise<Map<string, User>> {
    const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));
    const users = await this.users.findManyByIds(authorIds);
    return new Map(users.map((user) => [user.id, user]));
  }

  private mapPostToFeedItem(post: PostEntity, authors: Map<string, User>, viewerId: string, isLiked = false, isSaved = false): FeedItem {
    const author = authors.get(post.authorId);

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
      isLikedByViewer: isLiked,
      isSavedByViewer: isSaved,
      soundTrackUrl: undefined
    };
  }
}



