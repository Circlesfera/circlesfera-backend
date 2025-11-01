import { randomUUID } from 'node:crypto';

import type { CreatePostPayload } from '../dtos/create-post.dto.js';
import type { HomeFeedQuery } from '../dtos/home-feed.dto.js';
import type { PostEntity, PostRepository } from '../repositories/post.repository.js';
import { MongoPostRepository } from '../repositories/post.repository.js';
import type { User } from '@modules/users/models/user.model.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';

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
    private readonly users: UserRepository = new MongoUserRepository()
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

    const post = await this.posts.create({
      authorId: userId,
      caption: payload.caption,
      media
    });

    const author = await this.users.findById(userId);
    const authorsMap = new Map<string, User>();
    if (author) {
      authorsMap.set(author.id, author);
    }

    return this.mapPostToFeedItem(post, authorsMap, userId);
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
    const viewerId = userId;
    const data = items.map((post) => this.mapPostToFeedItem(post, authors, viewerId));

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  private async resolveRelevantAuthorIds(userId: string): Promise<string[]> {
    // TODO: integrar cuando exista el módulo de followers.
    return [userId];
  }

  private async fetchAuthors(posts: PostEntity[]): Promise<Map<string, User>> {
    const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));
    const users = await this.users.findManyByIds(authorIds);
    return new Map(users.map((user) => [user.id, user]));
  }

  private mapPostToFeedItem(post: PostEntity, authors: Map<string, User>, viewerId: string): FeedItem {
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
      isLikedByViewer: false,
      isSavedByViewer: false,
      soundTrackUrl: undefined
    };
  }
}



