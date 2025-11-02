import { randomUUID } from 'node:crypto';

import type { CreatePostPayload } from '../dtos/create-post.dto.js';
import type { HomeFeedQuery } from '../dtos/home-feed.dto.js';
import type { PostEntity, PostRepository } from '../repositories/post.repository.js';
import { MongoPostRepository } from '../repositories/post.repository.js';
import type { FollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import { MongoFollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import type { BlockRepository } from '@modules/interactions/repositories/block.repository.js';
import { MongoBlockRepository } from '@modules/interactions/repositories/block.repository.js';
import type { LikeRepository } from '@modules/interactions/repositories/like.repository.js';
import { MongoLikeRepository } from '@modules/interactions/repositories/like.repository.js';
import type { SaveRepository } from '@modules/interactions/repositories/save.repository.js';
import { MongoSaveRepository } from '@modules/interactions/repositories/save.repository.js';
import type { User } from '@modules/users/models/user.model.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { HashtagRepository } from '../repositories/hashtag.repository.js';
import { MongoHashtagRepository } from '../repositories/hashtag.repository.js';
import type { FollowHashtagRepository } from '../repositories/follow-hashtag.repository.js';
import { MongoFollowHashtagRepository } from '../repositories/follow-hashtag.repository.js';
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
    private readonly blocks: BlockRepository = new MongoBlockRepository(),
    private readonly likes: LikeRepository = new MongoLikeRepository(),
    private readonly saves: SaveRepository = new MongoSaveRepository(),
    private readonly hashtags: HashtagRepository = new MongoHashtagRepository(),
    private readonly mentions: MentionRepository = new MongoMentionRepository(),
    private readonly followHashtags: FollowHashtagRepository = new MongoFollowHashtagRepository()
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

  public async archivePost(postId: string, userId: string): Promise<void> {
    // Verificar que el post existe y el usuario es el autor
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    if (post.authorId !== userId) {
      throw new ApplicationError('No tienes permiso para archivar esta publicación', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.posts.archiveById(postId);
  }

  public async unarchivePost(postId: string, userId: string): Promise<void> {
    // Verificar que el post existe y el usuario es el autor
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    if (post.authorId !== userId) {
      throw new ApplicationError('No tienes permiso para desarchivar esta publicación', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.posts.unarchiveById(postId);
  }

  public async getArchivedPosts(userId: string, limit = 20, cursor?: Date): Promise<FeedCursorResult> {
    const result = await this.posts.findArchivedByAuthorId(userId, limit, cursor);

    if (result.items.length === 0) {
      return {
        data: [],
        nextCursor: null
      };
    }

    const feedItems = await this.mapPostsToFeedItems(result.items, userId);

    const lastItem = result.items[result.items.length - 1];
    const nextCursor = result.hasMore ? lastItem.createdAt.toISOString() : null;

    return {
      data: feedItems,
      nextCursor
    };
  }

  private async mapPostsToFeedItems(posts: PostEntity[], userId: string): Promise<FeedItem[]> {
    const authors = await this.fetchAuthors(posts);
    const postIds = posts.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    return posts.map((post) =>
      this.mapPostToFeedItem(post, authors, userId, likedPostIdsSet.has(post.id), savedPostIdsSet.has(post.id))
    );
  }

  public async getHomeFeed(userId: string, params: HomeFeedQuery): Promise<FeedCursorResult> {
    const limit = params.limit ?? 20;
    const cursorDate = params.cursor ? new Date(params.cursor) : undefined;
    const sortBy = params.sortBy ?? 'recent';

    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId), // Usuarios que yo bloqueé
      this.blocks.findBlockerIds(userId) // Usuarios que me bloquearon
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    // Obtener autores seguidos y hashtags seguidos
    const [authorIds, followedTags] = await Promise.all([
      this.resolveRelevantAuthorIds(userId),
      this.followHashtags.findFollowedTags(userId)
    ]);

    if (!authorIds.includes(userId)) {
      authorIds.push(userId);
    }

    // Buscar posts de usuarios seguidos
    const { items: feedItems, hasMore: feedHasMore } = await this.posts.findFeed({
      authorIds,
      limit: limit * 2, // Pedir más para combinar con posts de hashtags
      cursor: cursorDate,
      sortBy
    });

    // Buscar posts de hashtags seguidos (excluyendo posts de usuarios ya seguidos para evitar duplicados)
    let hashtagItems: PostEntity[] = [];
    let hashtagHasMore = false;

    if (followedTags.length > 0) {
      const { items: hashtagPosts, hasMore } = await this.posts.findByHashtags({
        hashtags: followedTags,
        limit: limit,
        cursor: cursorDate,
        excludeAuthorIds: authorIds // Excluir posts de usuarios ya seguidos
      });

      hashtagItems = hashtagPosts;
      hashtagHasMore = hasMore;
    }

    // Combinar y eliminar duplicados (por ID de post)
    const allItems = [...feedItems, ...hashtagItems];
    const uniqueItemsMap = new Map<string, PostEntity>();
    for (const item of allItems) {
      if (!uniqueItemsMap.has(item.id)) {
        uniqueItemsMap.set(item.id, item);
      }
    }

    // Ordenar por fecha de creación (más reciente primero)
    const combinedItems = Array.from(uniqueItemsMap.values()).sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Aplicar límite después de combinar
    const limitedItems = combinedItems.slice(0, limit);

    // Filtrar posts de usuarios bloqueados
    const filteredItems = limitedItems.filter((post) => !blockedUserIdsSet.has(post.authorId));

    if (filteredItems.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(filteredItems);
    const postIds = filteredItems.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const viewerId = userId;
    const data = filteredItems.map((post) =>
      this.mapPostToFeedItem(
        post,
        authors,
        viewerId,
        likedPostIdsSet.has(post.id),
        savedPostIdsSet.has(post.id)
      )
    );

    const lastItem = filteredItems[filteredItems.length - 1];
    const hasMoreResults = feedHasMore || hashtagHasMore || combinedItems.length > limit;
    const nextCursor = hasMoreResults ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  public async getExploreFeed(userId: string, limit = 20, cursor?: Date): Promise<FeedCursorResult> {
    const followingIds = await this.resolveRelevantAuthorIds(userId);

    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    const { items, hasMore } = await this.posts.findExplore({
      limit,
      cursor,
      excludeAuthorIds: followingIds // Excluir posts de usuarios seguidos
    });

    // Filtrar posts de usuarios bloqueados
    const filteredItems = items.filter((post) => !blockedUserIdsSet.has(post.authorId));

    if (filteredItems.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(filteredItems);
    const postIds = filteredItems.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const data = filteredItems.map((post) =>
      this.mapPostToFeedItem(
        post,
        authors,
        userId,
        likedPostIdsSet.has(post.id),
        savedPostIdsSet.has(post.id)
      )
    );

    const lastItem = filteredItems[filteredItems.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
  }

  public async getPostById(postId: string, userId: string): Promise<FeedItem | null> {
    const post = await this.posts.findById(postId);

    if (!post || post.stats === undefined) {
      return null;
    }

    // Verificar si hay bloqueo bidireccional
    const { user1BlocksUser2, user2BlocksUser1 } = await this.blocks.findMutualBlocks(userId, post.authorId);
    if (user1BlocksUser2 || user2BlocksUser1) {
      return null; // No mostrar post si hay bloqueo
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

    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    const postIds = mentions.map((mention) => mention.postId);
    const posts = await this.posts.findManyByIds(postIds);

    // Mantener el orden de las menciones (más reciente primero)
    const postsMap = new Map(posts.map((post) => [post.id, post]));
    const orderedPosts = mentions
      .map((mention) => postsMap.get(mention.postId))
      .filter((post): post is PostEntity => post !== undefined)
      .filter((post) => !blockedUserIdsSet.has(post.authorId)); // Filtrar usuarios bloqueados

    if (orderedPosts.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(orderedPosts);
    const filteredPostIds = orderedPosts.map((p) => p.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, filteredPostIds),
      this.saves.findSavedPostIds(userId, filteredPostIds)
    ]);
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

    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    // Filtrar posts de usuarios bloqueados
    const filteredItems = result.items.filter((post) => !blockedUserIdsSet.has(post.authorId));

    if (filteredItems.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(filteredItems);
    const postIds = filteredItems.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);

    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const items = filteredItems.map((post) =>
      this.mapPostToFeedItem(post, authors, userId, likedPostIdsSet.has(post.id), savedPostIdsSet.has(post.id))
    );

    const lastPost = filteredItems[filteredItems.length - 1];
    const nextCursor = result.hasMore ? lastPost.createdAt.toISOString() : null;

    return { data: items, nextCursor };
  }

  public async getRelatedPosts(postId: string, userId: string, limit = 6): Promise<FeedItem[]> {
    const post = await this.posts.findById(postId);

    if (!post) {
      return [];
    }

    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    // Buscar posts con hashtags similares o del mismo autor
    const authorPosts = await this.posts.findByAuthorId({
      authorId: post.authorId,
      limit: Math.ceil(limit / 2),
      cursor: new Date() // Posts recientes del mismo autor
    });

    // Filtrar el post actual y usuarios bloqueados
    const relatedByAuthor = authorPosts.items
      .filter((p) => p.id !== postId && !blockedUserIdsSet.has(p.authorId))
      .slice(0, 3);

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
        .filter((p) => p.id !== postId && p.authorId !== post.authorId && !blockedUserIdsSet.has(p.authorId))
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

    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    // Filtrar posts de usuarios bloqueados
    const filteredItems = items.filter((post) => !blockedUserIdsSet.has(post.authorId));

    if (filteredItems.length === 0) {
      return { data: [], nextCursor: null };
    }

    const authors = await this.fetchAuthors(filteredItems);
    const postIds = filteredItems.map((post) => post.id);
    const [likedPostIds, savedPostIds] = await Promise.all([
      this.likes.findLikedPostIds(userId, postIds),
      this.saves.findSavedPostIds(userId, postIds)
    ]);
    const likedPostIdsSet = new Set(likedPostIds);
    const savedPostIdsSet = new Set(savedPostIds);

    const data = filteredItems.map((post) =>
      this.mapPostToFeedItem(
        post,
        authors,
        userId,
        likedPostIdsSet.has(post.id),
        savedPostIdsSet.has(post.id)
      )
    );

    const lastItem = filteredItems[filteredItems.length - 1];
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

  public async getReelsFeed(userId: string, limit = 20, cursor?: Date): Promise<FeedCursorResult> {
    // Obtener IDs de usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    // Obtener reels excluyendo usuarios bloqueados
    const excludeAuthorIds = Array.from(blockedUserIdsSet);
    const result = await this.posts.findReels({
      limit,
      cursor,
      excludeAuthorIds
    });

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

    const data = result.items.map((post) =>
      this.mapPostToFeedItem(post, authors, userId, likedPostIdsSet.has(post.id), savedPostIdsSet.has(post.id))
    );

    const lastItem = result.items[result.items.length - 1];
    const nextCursor = result.hasMore ? lastItem.createdAt.toISOString() : null;

    return { data, nextCursor };
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



