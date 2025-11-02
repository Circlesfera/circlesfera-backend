import { randomUUID } from 'node:crypto';

import type { StoryRepository, StoryEntity, StoryMediaEntity } from '../repositories/story.repository.js';
import { MongoStoryRepository } from '../repositories/story.repository.js';
import type { StoryViewRepository } from '../repositories/story-view.repository.js';
import { MongoStoryViewRepository } from '../repositories/story-view.repository.js';
import type { FollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import { MongoFollowRepository } from '@modules/interactions/repositories/follow.repository.js';
import type { BlockRepository } from '@modules/interactions/repositories/block.repository.js';
import { MongoBlockRepository } from '@modules/interactions/repositories/block.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { CreateStoryPayload } from '../dtos/create-story.dto.js';
import { ApplicationError } from '@core/errors/application-error.js';

export interface StoryUser {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
}

export interface StoryItem {
  id: string;
  author: StoryUser;
  media: StoryMediaEntity;
  viewCount: number;
  hasViewed: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface StoryGroup {
  author: StoryUser;
  stories: StoryItem[];
}

export class StoryService {
  public constructor(
    private readonly stories: StoryRepository = new MongoStoryRepository(),
    private readonly storyViews: StoryViewRepository = new MongoStoryViewRepository(),
    private readonly users: UserRepository = new MongoUserRepository(),
    private readonly follows: FollowRepository = new MongoFollowRepository(),
    private readonly blocks: BlockRepository = new MongoBlockRepository()
  ) {}

  public async createStory(userId: string, payload: CreateStoryPayload): Promise<StoryItem> {
    const media: StoryMediaEntity = {
      id: randomUUID(),
      kind: payload.media.kind,
      url: payload.media.url,
      thumbnailUrl: payload.media.thumbnailUrl,
      durationMs: payload.media.durationMs,
      width: payload.media.width,
      height: payload.media.height
    };

    const story = await this.stories.create(userId, media);

    const author = await this.users.findById(userId);
    if (!author) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.mapStoryToItem(story, author, userId, false);
  }

  public async getStoryFeed(userId: string): Promise<StoryGroup[]> {
    // Obtener usuarios seguidos
    const followingIds = await this.follows.findFollowingIds(userId);

    if (followingIds.length === 0) {
      return [];
    }

    // Obtener usuarios bloqueados (bidireccional)
    const [blockedIds, blockerIds] = await Promise.all([
      this.blocks.findBlockedIds(userId),
      this.blocks.findBlockerIds(userId)
    ]);
    const blockedUserIdsSet = new Set([...blockedIds, ...blockerIds]);

    // Filtrar usuarios seguidos que no estén bloqueados
    const validAuthorIds = followingIds.filter((id) => !blockedUserIdsSet.has(id));

    if (validAuthorIds.length === 0) {
      return [];
    }

    // Obtener stories de usuarios seguidos
    const stories = await this.stories.findByAuthorIds(validAuthorIds);

    if (stories.length === 0) {
      return [];
    }

    // Agrupar por autor
    const storiesByAuthor = new Map<string, StoryEntity[]>();
    for (const story of stories) {
      const authorStories = storiesByAuthor.get(story.authorId) ?? [];
      authorStories.push(story);
      storiesByAuthor.set(story.authorId, authorStories);
    }

    // Obtener información de autores
    const authorIds = Array.from(storiesByAuthor.keys());
    const authors = await this.users.findManyByIds(authorIds);
    const authorsMap = new Map(authors.map((user) => [user.id, user]));

    // Construir grupos
    const groups: StoryGroup[] = [];

    for (const [authorId, authorStories] of storiesByAuthor.entries()) {
      const author = authorsMap.get(authorId);
      if (!author) {
        continue;
      }

      // Ordenar stories por fecha (más reciente primero)
      const sortedStories = authorStories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Verificar si el usuario ya vio alguna story
      const viewerIdsSet = new Set<string>();
      for (const story of sortedStories) {
        for (const viewerId of story.viewerIds) {
          viewerIdsSet.add(viewerId);
        }
      }
      const hasViewedAny = viewerIdsSet.has(userId);

      const storyItems = sortedStories.map((story) =>
        this.mapStoryToItem(story, author, userId, story.viewerIds.includes(userId))
      );

      groups.push({
        author: {
          id: author.id,
          handle: author.handle,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl ?? '',
          isVerified: Boolean((author as { isVerified?: boolean } | undefined)?.isVerified)
        },
        stories: storyItems
      });
    }

    // Ordenar grupos: primero los que no se han visto
    return groups.sort((a, b) => {
      const aViewed = a.stories.some((s) => s.hasViewed);
      const bViewed = b.stories.some((s) => s.hasViewed);
      if (aViewed === bViewed) {
        return 0;
      }
      return aViewed ? 1 : -1;
    });
  }

  public async getUserStories(authorId: string, viewerId: string): Promise<StoryItem[]> {
    const stories = await this.stories.findByAuthorId(authorId);

    if (stories.length === 0) {
      return [];
    }

    const author = await this.users.findById(authorId);
    if (!author) {
      return [];
    }

    return stories.map((story) =>
      this.mapStoryToItem(story, author, viewerId, story.viewerIds.includes(viewerId))
    );
  }

  public async viewStory(storyId: string, viewerId: string): Promise<void> {
    const story = await this.stories.findById(storyId);
    if (!story) {
      throw new ApplicationError('Story no encontrada o expirada', {
        statusCode: 404,
        code: 'STORY_NOT_FOUND'
      });
    }

    // No permitir que el autor se vea a sí mismo
    if (story.authorId === viewerId) {
      return;
    }

    // Registrar la vista en StoryView (para lista detallada)
    const alreadyViewed = await this.storyViews.exists(storyId, viewerId);
    if (!alreadyViewed) {
      await this.storyViews.create(storyId, viewerId);
      // Actualizar también el viewCount y viewerIds en Story (para compatibilidad)
      await this.stories.addViewer(storyId, viewerId);
    }
  }

  public async getStoryById(storyId: string, viewerId: string): Promise<StoryItem | null> {
    const story = await this.stories.findById(storyId);
    if (!story) {
      return null;
    }

    const author = await this.users.findById(story.authorId);
    if (!author) {
      return null;
    }

    return this.mapStoryToItem(story, author, viewerId, story.viewerIds.includes(viewerId));
  }

  public async getStoryViewers(storyId: string, authorId: string, limit = 50): Promise<StoryUser[]> {
    // Verificar que la story existe y pertenece al autor
    const story = await this.stories.findById(storyId);
    if (!story) {
      throw new ApplicationError('Story no encontrada', {
        statusCode: 404,
        code: 'STORY_NOT_FOUND'
      });
    }

    if (story.authorId !== authorId) {
      throw new ApplicationError('No tienes permiso para ver los viewers de esta story', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Obtener viewers
    const viewersInfo = await this.storyViews.findViewersByStoryId(storyId, limit);

    if (viewersInfo.length === 0) {
      return [];
    }

    // Obtener información de usuarios
    const viewerIds = viewersInfo.map((info) => info.viewerId);
    const users = await this.users.findManyByIds(viewerIds);
    const usersMap = new Map(users.map((user) => [user.id, user]));

    // Mapear a StoryUser, manteniendo el orden de visualización (más recientes primero)
    return viewersInfo
      .map((info) => {
        const user = usersMap.get(info.viewerId);
        if (!user) {
          return null;
        }
        return {
          id: user.id,
          handle: user.handle,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl ?? '',
          isVerified: Boolean((user as { isVerified?: boolean } | undefined)?.isVerified)
        };
      })
      .filter((user): user is StoryUser => user !== null);
  }

  private mapStoryToItem(
    story: StoryEntity,
    author: { id: string; handle: string; displayName: string; avatarUrl?: string | null; isVerified?: boolean },
    viewerId: string,
    hasViewed: boolean
  ): StoryItem {
    return {
      id: story.id,
      author: {
        id: author.id,
        handle: author.handle,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl ?? '',
        isVerified: Boolean(author.isVerified)
      },
      media: story.media,
      viewCount: story.viewCount,
      hasViewed,
      expiresAt: story.expiresAt.toISOString(),
      createdAt: story.createdAt.toISOString()
    };
  }
}

