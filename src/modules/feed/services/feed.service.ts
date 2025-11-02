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
import { ApplicationError } from '@core/errors/application-error.js';
import { extractHashtags } from '../utils/hashtag-extractor.js';
import { extractMentions } from '../utils/mentions.js';
import type { MentionRepository } from '../repositories/mention.repository.js';
import { MongoMentionRepository } from '../repositories/mention.repository.js';
import type { UpdatePostPayload } from '../dtos/update-post.dto.js';

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
    private readonly hashtags: HashtagRepository = new MongoHashtagRepository(),
    private readonly mentions: MentionRepository = new MongoMentionRepository()
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

    // Extraer hashtags y menciones del caption
    const extractedHashtags = extractHashtags(payload.caption);
    const mentionedHandles = extractMentions(payload.caption);

    const post = await this.posts.create({
      authorId: userId,
      caption: payload.caption,
      media,
      hashtags: extractedHashtags
    });

    // Procesar menciones: buscar usuarios por handle y crear menciones
    if (mentionedHandles.length > 0) {
      const mentionedUsers = await this.users.findManyByHandles(mentionedHandles);
      const mentionInputs = mentionedUsers
        .filter((user) => user.id !== userId) // No mencionarse a uno mismo
        .map((user) => ({
          postId: post.id,
          mentionedUserId: user.id
        }));

      if (mentionInputs.length > 0) {
        await this.mentions.createMany(mentionInputs);
      }
    }

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

  public async updatePost(postId: string, userId: string, payload: UpdatePostPayload): Promise<FeedItem> {
    // Verificar que el post existe y el usuario es el autor
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    if (post.authorId !== userId) {
      throw new ApplicationError('No tienes permiso para editar esta publicación', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Extraer hashtags y menciones del nuevo caption
    const extractedHashtags = extractHashtags(payload.caption);
    const mentionedHandles = extractMentions(payload.caption);

    // Actualizar el post
    const updatedPost = await this.posts.updateCaption(postId, payload.caption, extractedHashtags);

    // Eliminar menciones antiguas y crear nuevas
    await this.mentions.deleteByPostId(postId);

    if (mentionedHandles.length > 0) {
      const mentionedUsers = await this.users.findManyByHandles(mentionedHandles);
      const mentionInputs = mentionedUsers
        .filter((user) => user.id !== userId)
        .map((user) => ({
          postId: updatedPost.id,
          mentionedUserId: user.id
        }));

      if (mentionInputs.length > 0) {
        await this.mentions.createMany(mentionInputs);
      }
    }

    // Actualizar contadores de hashtags (no bloqueante)
    if (extractedHashtags.length > 0) {
      this.hashtags.createOrUpdate(extractedHashtags).catch((error) => {
        console.error('Error al actualizar hashtags:', error);
      });
    }

    // Obtener datos completos para la respuesta
    const author = await this.users.findById(userId);
    const authorsMap = new Map<string, User>();
    if (author) {
      authorsMap.set(author.id, author);
    }

    const [isLiked, isSaved] = await Promise.all([
      this.likes.exists(updatedPost.id, userId),
      this.saves.exists(updatedPost.id, userId)
    ]);

    return this.mapPostToFeedItem(updatedPost, authorsMap, userId, isLiked, isSaved);
  }

  public async deletePost(postId: string, userId: string): Promise<void> {
    // Verificar que el post existe y el usuario es el autor
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    if (post.authorId !== userId) {
      throw new ApplicationError('No tienes permiso para eliminar esta publicación', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Soft delete (marcar como eliminado)
    await this.posts.deleteById(postId);

    // Eliminar menciones asociadas
    await this.mentions.deleteByPostId(postId);
  }

  public async getHomeFeed(userId: string, params: HomeFeedQuery): Promise<FeedCursorResult> {
    const limit = params.limit ?? 20;
    const cursorDate = params.cursor ? new Date(params.cursor) : undefined;
    const sortBy = params.sortBy ?? 'recent';

    const authorIds = await this.resolveRelevantAuthorIds(userId);
    if (!authorIds.includes(userId)) {
      authorIds.push(userId);
    }

    const { items, hasMore } = await this.posts.findFeed({
      authorIds,
      limit,
      cursor: cursorDate,
      sortBy
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

  public async getPostById(postId: string, userId: string): Promise<FeedItem | null> {
    const post = await this.posts.findById(postId);

    if (!post || post.stats === undefined) {
      return null;
    }

    const authors = await this.fetchAuthors([post]);
    const [isLiked, isSaved] = await Promise.all([
      this.likes.exists(post.id, userId),
      this.saves.exists(post.id, userId)
    ]);

    return this.mapPostToFeedItem(post, authors, userId, isLiked, isSaved);
  }

  /**
   * Obtiene posts relacionados basados en hashtags compartidos y mismo autor.
   */
  /**
   * Obtiene los posts donde el usuario fue mencionado.
   */
  public async getMentionsFeed(userId: string, limit = 20, cursor?: Date): Promise<FeedCursorResult> {
    const { mentions, hasMore } = await this.mentions.findByUserId(userId, limit, cursor);

    if (mentions.length === 0) {
      return { data: [], nextCursor: null };
    }

    const postIds = mentions.map((mention) => mention.postId);
    const posts = await this.posts.findManyByIds(postIds);

    // Mantener el orden de las menciones (más reciente primero)
    const postsMap = new Map(posts.map((post) => [post.id, post]));
    const orderedPosts = mentions
      .map((mention) => postsMap.get(mention.postId))
      .filter((post): post is PostEntity => post !== undefined);

    if (orderedPosts.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(orderedPosts);
    const likedPostIds = await this.likes.findLikedPostIds(userId, postIds);
    const savedPostIds = await this.saves.findSavedPostIds(userId, postIds);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const data = orderedPosts.map((post) =>
      this.mapPostToFeedItem(post, authors, userId, likedPostIdsSet.has(post.id), savedPostIdsSet.has(post.id))
    );

    const lastMention = mentions[mentions.length - 1];
    const nextCursor = hasMore ? lastMention.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  public async searchPosts(query: string, userId: string, limit = 20, cursor?: Date): Promise<{
    data: FeedItem[];
    nextCursor: string | null;
  }> {
    const result = await this.posts.searchPosts({ query, limit, cursor });

    if (result.items.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(result.items);
    const postIds = result.items.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);

    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const items = result.items.map((post) =>
      this.mapPostToFeedItem(post, authors, userId, likedPostIdsSet.has(post.id), savedPostIdsSet.has(post.id))
    );

    const lastPost = result.items[result.items.length - 1];
    const nextCursor = result.hasMore ? lastPost.createdAt.toISOString() : null;

    return { data: items, nextCursor };
  }

  public async getRelatedPosts(postId: string, userId: string, limit = 6): Promise<FeedItem[]> {
    const post = await this.posts.findById(postId);

    if (!post) {
      return [];
    }

    // Buscar posts con hashtags similares o del mismo autor
    const authorPosts = await this.posts.findByAuthorId({
      authorId: post.authorId,
      limit: Math.ceil(limit / 2),
      cursor: new Date() // Posts recientes del mismo autor
    });

    // Filtrar el post actual
    const relatedByAuthor = authorPosts.items.filter((p) => p.id !== postId).slice(0, 3);

    // Si tenemos hashtags, buscar posts con hashtags compartidos
    let relatedByHashtag: PostEntity[] = [];
    if (post.hashtags && post.hashtags.length > 0) {
      // Buscar posts que compartan al menos un hashtag
      const hashtagPosts = await Promise.all(
        post.hashtags.slice(0, 2).map((tag) =>
          this.posts.findByHashtag({
            hashtag: tag,
            limit: 5,
            cursor: new Date()
          })
        )
      );

      relatedByHashtag = hashtagPosts
        .flatMap((result) => result.items)
        .filter((p) => p.id !== postId && p.authorId !== post.authorId)
        .slice(0, 3);
    }

    // Combinar y limitar
    const allRelated = [...relatedByAuthor, ...relatedByHashtag]
      .filter((p, index, self) => self.findIndex((other) => other.id === p.id) === index) // Eliminar duplicados
      .slice(0, limit);

    if (allRelated.length === 0) {
      return [];
    }

    const authors = await this.fetchAuthors(allRelated);
    const postIds = allRelated.map((p) => p.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    return allRelated.map((p) =>
      this.mapPostToFeedItem(p, authors, userId, likedPostIdsSet.has(p.id), savedPostIdsSet.has(p.id))
    );
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



