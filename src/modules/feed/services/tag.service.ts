import { ApplicationError } from '@core/errors/application-error.js';

import type { TagRepository } from '../repositories/tag.repository.js';
import { MongoTagRepository } from '../repositories/tag.repository.js';
import type { PostRepository } from '../repositories/post.repository.js';
import { MongoPostRepository } from '../repositories/post.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import { NotificationService } from '@modules/notifications/services/notification.service.js';

export interface TagWithUser {
  id: string;
  userId: string;
  user: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  mediaIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isNormalized: boolean;
}

export interface CreateTagInput {
  postId: string;
  userId: string;
  mediaIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isNormalized?: boolean;
}

export class TagService {
  public constructor(
    private readonly tags: TagRepository = new MongoTagRepository(),
    private readonly posts: PostRepository = new MongoPostRepository(),
    private readonly users: UserRepository = new MongoUserRepository(),
    private readonly notifications: NotificationService = new NotificationService()
  ) {}

  /**
   * Crea un tag en un post.
   * Valida que el post existe, que el mediaIndex es válido y que las coordenadas están dentro del media.
   */
  public async createTag(postId: string, authorId: string, input: CreateTagInput): Promise<TagWithUser> {
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    // Solo el autor puede etiquetar en su post
    if (post.authorId !== authorId) {
      throw new ApplicationError('Solo el autor puede etiquetar usuarios en esta publicación', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Validar que el mediaIndex existe
    if (input.mediaIndex < 0 || input.mediaIndex >= post.media.length) {
      throw new ApplicationError('Índice de media inválido', {
        statusCode: 400,
        code: 'INVALID_MEDIA_INDEX'
      });
    }

    const media = post.media[input.mediaIndex];
    if (!media) {
      throw new ApplicationError('Media no encontrado', {
        statusCode: 404,
        code: 'MEDIA_NOT_FOUND'
      });
    }

    // Validar coordenadas
    if (input.isNormalized) {
      // Coordenadas normalizadas (0-1)
      if (input.x < 0 || input.x > 1 || input.y < 0 || input.y > 1) {
        throw new ApplicationError('Coordenadas normalizadas deben estar entre 0 y 1', {
          statusCode: 400,
          code: 'INVALID_COORDINATES'
        });
      }
    } else {
      // Coordenadas absolutas en píxeles
      if (media.width && (input.x < 0 || input.x > media.width)) {
        throw new ApplicationError('Coordenada X fuera de los límites del media', {
          statusCode: 400,
          code: 'INVALID_COORDINATES'
        });
      }
      if (media.height && (input.y < 0 || input.y > media.height)) {
        throw new ApplicationError('Coordenada Y fuera de los límites del media', {
          statusCode: 400,
          code: 'INVALID_COORDINATES'
        });
      }
    }

    // Verificar que el usuario existe
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    // Crear el tag (el repositorio maneja el índice único)
    const tag = await this.tags.create({
      postId,
      userId: input.userId,
      mediaIndex: input.mediaIndex,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      isNormalized: input.isNormalized ?? false
    });

    // Crear notificación si no es auto-etiquetado
    if (input.userId !== authorId) {
      await this.notifications.createNotification({
        type: 'tagged',
        actorId: authorId,
        userId: input.userId,
        targetModel: 'Post',
        targetId: postId,
        postId
      });
    }

    return {
      id: tag.id,
      userId: tag.userId,
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? ''
      },
      mediaIndex: tag.mediaIndex,
      x: tag.x,
      y: tag.y,
      width: tag.width,
      height: tag.height,
      isNormalized: tag.isNormalized
    };
  }

  /**
   * Obtiene todos los tags de un post.
   */
  public async getTagsByPostId(postId: string): Promise<TagWithUser[]> {
    const tags = await this.tags.findByPostId(postId);
    if (tags.length === 0) {
      return [];
    }

    const userIds = Array.from(new Set(tags.map((tag) => tag.userId)));
    const users = await this.users.findManyByIds(userIds);
    const usersMap = new Map(users.map((user) => [user.id, user]));

    return tags.map((tag) => {
      const user = usersMap.get(tag.userId);
      return {
        id: tag.id,
        userId: tag.userId,
        user: user
          ? {
              id: user.id,
              handle: user.handle,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl ?? ''
            }
          : {
              id: tag.userId,
              handle: 'usuario',
              displayName: 'Usuario desconocido',
              avatarUrl: ''
            },
        mediaIndex: tag.mediaIndex,
        x: tag.x,
        y: tag.y,
        width: tag.width,
        height: tag.height,
        isNormalized: tag.isNormalized
      };
    });
  }

  /**
   * Elimina un tag.
   * Solo el autor del post o el usuario etiquetado pueden eliminar el tag.
   */
  public async deleteTag(tagId: string, userId: string): Promise<void> {
    const tag = await this.tags.findById(tagId);
    if (!tag) {
      throw new ApplicationError('Tag no encontrado', {
        statusCode: 404,
        code: 'TAG_NOT_FOUND'
      });
    }

    const post = await this.posts.findById(tag.postId);
    if (!post) {
      throw new ApplicationError('Publicación no encontrada', {
        statusCode: 404,
        code: 'POST_NOT_FOUND'
      });
    }

    // Solo el autor del post o el usuario etiquetado pueden eliminar
    if (post.authorId !== userId && tag.userId !== userId) {
      throw new ApplicationError('No tienes permiso para eliminar este tag', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    await this.tags.delete(tagId);
  }

  /**
   * Obtiene posts donde un usuario está etiquetado.
   */
  public async getTaggedPosts(userId: string, limit = 20, cursor?: Date): Promise<{
    items: Array<{
      postId: string;
      mediaIndex: number;
      x: number;
      y: number;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const result = await this.tags.findByUserId(userId, limit, cursor);

    const lastTag = result.items[result.items.length - 1];
    const nextCursor = result.hasMore ? lastTag.createdAt.toISOString() : null;

    return {
      items: result.items.map((tag) => ({
        postId: tag.postId,
        mediaIndex: tag.mediaIndex,
        x: tag.x,
        y: tag.y,
        createdAt: tag.createdAt.toISOString()
      })),
      nextCursor
    };
  }
}

