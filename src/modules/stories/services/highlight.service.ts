import type { HighlightRepository } from '../repositories/highlight.repository.js';
import { MongoHighlightRepository } from '../repositories/highlight.repository.js';
import type { StoryRepository } from '../repositories/story.repository.js';
import { MongoStoryRepository } from '../repositories/story.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import { ApplicationError } from '@core/errors/application-error.js';

export interface HighlightItem {
  id: string;
  name: string;
  storyIds: string[];
  coverImageUrl?: string;
  storyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HighlightWithStories {
  id: string;
  name: string;
  userId: string;
  stories: Array<{
    id: string;
    media: {
      id: string;
      kind: 'image' | 'video';
      url: string;
      thumbnailUrl: string;
      durationMs?: number;
      width?: number;
      height?: number;
    };
    viewCount: number;
    createdAt: string;
  }>;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export class HighlightService {
  public constructor(
    private readonly highlights: HighlightRepository = new MongoHighlightRepository(),
    private readonly stories: StoryRepository = new MongoStoryRepository(),
    private readonly users: UserRepository = new MongoUserRepository()
  ) {}

  public async createHighlight(userId: string, name: string): Promise<HighlightItem> {
    // Validar que no exista un highlight con el mismo nombre
    const existingHighlights = await this.highlights.findByUserId(userId);
    const duplicateName = existingHighlights.find((h) => h.name.toLowerCase() === name.toLowerCase());

    if (duplicateName) {
      throw new ApplicationError('Ya existe un highlight con ese nombre', {
        statusCode: 400,
        code: 'HIGHLIGHT_NAME_EXISTS'
      });
    }

    const highlight = await this.highlights.create(userId, name);

    return this.mapHighlightToItem(highlight);
  }

  public async getUserHighlights(userId: string): Promise<HighlightItem[]> {
    const highlights = await this.highlights.findByUserId(userId);

    return highlights.map((highlight) => this.mapHighlightToItem(highlight));
  }

  public async getHighlightById(highlightId: string, viewerId: string): Promise<HighlightWithStories | null> {
    const highlight = await this.highlights.findById(highlightId);

    if (!highlight) {
      return null;
    }

    // Verificar permisos: solo el dueño puede ver sus highlights
    // (En el futuro podríamos hacerlos públicos)
    if (highlight.userId !== viewerId) {
      throw new ApplicationError('No tienes permiso para ver este highlight', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Obtener todas las stories del highlight (incluyendo expiradas)
    const storyEntities = await this.stories.findByIds(highlight.storyIds);

    // Ordenar por fecha de creación (más reciente primero)
    storyEntities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Actualizar coverImage si no existe y hay stories
    if (!highlight.coverImageUrl && storyEntities.length > 0) {
      const firstStory = storyEntities[0];
      await this.highlights.update(highlight.id, { coverImageUrl: firstStory.media.thumbnailUrl });
      highlight.coverImageUrl = firstStory.media.thumbnailUrl;
    }

    return {
      id: highlight.id,
      name: highlight.name,
      userId: highlight.userId,
      stories: storyEntities.map((story) => ({
        id: story.id,
        media: story.media,
        viewCount: story.viewCount,
        createdAt: story.createdAt.toISOString()
      })),
      coverImageUrl: highlight.coverImageUrl,
      createdAt: highlight.createdAt.toISOString(),
      updatedAt: highlight.updatedAt.toISOString()
    };
  }

  public async updateHighlight(highlightId: string, userId: string, updates: { name?: string }): Promise<HighlightItem> {
    const highlight = await this.highlights.findById(highlightId);

    if (!highlight) {
      throw new ApplicationError('Highlight no encontrado', {
        statusCode: 404,
        code: 'HIGHLIGHT_NOT_FOUND'
      });
    }

    if (highlight.userId !== userId) {
      throw new ApplicationError('No tienes permiso para editar este highlight', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Validar nombre único si se está cambiando
    if (updates.name) {
      const existingHighlights = await this.highlights.findByUserId(userId);
      const duplicateName = existingHighlights.find(
        (h) => h.id !== highlightId && h.name.toLowerCase() === updates.name!.toLowerCase()
      );

      if (duplicateName) {
        throw new ApplicationError('Ya existe un highlight con ese nombre', {
          statusCode: 400,
          code: 'HIGHLIGHT_NAME_EXISTS'
        });
      }
    }

    const updated = await this.highlights.update(highlightId, updates);

    return this.mapHighlightToItem(updated);
  }

  public async deleteHighlight(highlightId: string, userId: string): Promise<void> {
    const highlight = await this.highlights.findById(highlightId);

    if (!highlight) {
      throw new ApplicationError('Highlight no encontrado', {
        statusCode: 404,
        code: 'HIGHLIGHT_NOT_FOUND'
      });
    }

    if (highlight.userId !== userId) {
      throw new ApplicationError('No tienes permiso para eliminar este highlight', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.highlights.delete(highlightId);
  }

  public async addStoryToHighlight(highlightId: string, userId: string, storyId: string): Promise<void> {
    const highlight = await this.highlights.findById(highlightId);

    if (!highlight) {
      throw new ApplicationError('Highlight no encontrado', {
        statusCode: 404,
        code: 'HIGHLIGHT_NOT_FOUND'
      });
    }

    if (highlight.userId !== userId) {
      throw new ApplicationError('No tienes permiso para editar este highlight', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Verificar que la story existe y pertenece al usuario
    const story = await this.stories.findById(storyId);
    if (!story) {
      throw new ApplicationError('Story no encontrada', {
        statusCode: 404,
        code: 'STORY_NOT_FOUND'
      });
    }

    if (story.authorId !== userId) {
      throw new ApplicationError('No puedes agregar stories de otros usuarios', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.highlights.addStory(highlightId, storyId);

    // Actualizar coverImage si no existe
    if (!highlight.coverImageUrl) {
      await this.highlights.update(highlightId, { coverImageUrl: story.media.thumbnailUrl });
    }
  }

  public async removeStoryFromHighlight(highlightId: string, userId: string, storyId: string): Promise<void> {
    const highlight = await this.highlights.findById(highlightId);

    if (!highlight) {
      throw new ApplicationError('Highlight no encontrado', {
        statusCode: 404,
        code: 'HIGHLIGHT_NOT_FOUND'
      });
    }

    if (highlight.userId !== userId) {
      throw new ApplicationError('No tienes permiso para editar este highlight', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.highlights.removeStory(highlightId, storyId);

    // Obtener el highlight actualizado para verificar las stories restantes
    const updatedHighlight = await this.highlights.findById(highlightId);
    if (!updatedHighlight) {
      return;
    }

    // Actualizar coverImage si la story eliminada era la primera o si era la única
    if (highlight.storyIds.length > 0 && (highlight.storyIds[0] === storyId || updatedHighlight.storyIds.length === 0)) {
      if (updatedHighlight.storyIds.length > 0) {
        // Obtener la primera story restante
        const remainingStories = await this.stories.findByIds(updatedHighlight.storyIds.slice(0, 1));
        const firstStory = remainingStories[0];

        if (firstStory) {
          await this.highlights.update(highlightId, { coverImageUrl: firstStory.media.thumbnailUrl });
        }
      } else {
        // No quedan stories, eliminar coverImage
        await this.highlights.update(highlightId, { coverImageUrl: undefined });
      }
    }
  }

  private mapHighlightToItem(highlight: {
    id: string;
    name: string;
    storyIds: string[];
    coverImageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
  }): HighlightItem {
    return {
      id: highlight.id,
      name: highlight.name,
      storyIds: highlight.storyIds,
      coverImageUrl: highlight.coverImageUrl,
      storyCount: highlight.storyIds.length,
      createdAt: highlight.createdAt.toISOString(),
      updatedAt: highlight.updatedAt.toISOString()
    };
  }
}

