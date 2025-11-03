import { ApplicationError } from '@core/errors/application-error.js';

import type { StoryReactionRepository } from '../repositories/story-reaction.repository.js';
import { MongoStoryReactionRepository } from '../repositories/story-reaction.repository.js';
import type { StoryRepository } from '../repositories/story.repository.js';
import { MongoStoryRepository } from '../repositories/story.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import { NotificationService } from '@modules/notifications/services/notification.service.js';
import { ALLOWED_REACTION_EMOJIS, type ReactionEmoji } from '../models/story-reaction.model.js';

export interface StoryReactionWithUser {
  id: string;
  userId: string;
  emoji: ReactionEmoji;
  user: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string;
  };
  createdAt: string;
}

export interface ReactionCounts {
  [emoji: string]: number;
}

export class StoryReactionService {
  public constructor(
    private readonly reactions: StoryReactionRepository = new MongoStoryReactionRepository(),
    private readonly stories: StoryRepository = new MongoStoryRepository(),
    private readonly users: UserRepository = new MongoUserRepository(),
    private readonly notifications: NotificationService = new NotificationService()
  ) {}

  /**
   * Crea o actualiza una reacción a una story.
   * Si el usuario ya reaccionó, actualiza el emoji.
   */
  public async reactToStory(storyId: string, userId: string, emoji: ReactionEmoji): Promise<StoryReactionWithUser> {
    // Validar emoji
    if (!ALLOWED_REACTION_EMOJIS.includes(emoji)) {
      throw new ApplicationError('Emoji de reacción no válido', {
        statusCode: 400,
        code: 'INVALID_EMOJI'
      });
    }

    // Verificar que la story existe
    const story = await this.stories.findById(storyId);
    if (!story) {
      throw new ApplicationError('Story no encontrada o expirada', {
        statusCode: 404,
        code: 'STORY_NOT_FOUND'
      });
    }

    // Verificar que no es el autor (opcional: Instagram permite reacciones del autor)
    // Por ahora permitimos que el autor también reaccione

    // Obtener o crear reacción
    const existingReaction = await this.reactions.findByStoryIdAndUserId(storyId, userId);
    
    // Si ya existe la misma reacción, eliminar (toggle)
    if (existingReaction && existingReaction.emoji === emoji) {
      await this.reactions.delete(storyId, userId);
      throw new ApplicationError('Reacción eliminada', {
        statusCode: 200,
        code: 'REACTION_REMOVED'
      });
    }

    // Crear o actualizar reacción
    const reaction = await this.reactions.create({
      storyId,
      userId,
      emoji
    });

    // Obtener información del usuario
    const user = await this.users.findById(userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    // Crear notificación si no es auto-reacción
    if (story.authorId !== userId) {
      await this.notifications.createNotification({
        type: 'like', // Reutilizamos 'like' para reacciones también
        actorId: userId,
        userId: story.authorId.toString()
        // No incluimos postId para stories
      });
    }

    return {
      id: reaction.id,
      userId: reaction.userId,
      emoji: reaction.emoji,
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? ''
      },
      createdAt: reaction.createdAt.toISOString()
    };
  }

  /**
   * Obtiene todas las reacciones de una story.
   */
  public async getStoryReactions(storyId: string): Promise<{
    reactions: StoryReactionWithUser[];
    counts: ReactionCounts;
  }> {
    const reactionEntities = await this.reactions.findByStoryId(storyId);
    const counts = await this.reactions.countByStoryId(storyId);

    if (reactionEntities.length === 0) {
      return { reactions: [], counts };
    }

    const userIds = Array.from(new Set(reactionEntities.map((r) => r.userId)));
    const users = await this.users.findManyByIds(userIds);
    const usersMap = new Map(users.map((user) => [user.id, user]));

    const reactions: StoryReactionWithUser[] = reactionEntities.map((reaction) => {
      const user = usersMap.get(reaction.userId);
      return {
        id: reaction.id,
        userId: reaction.userId,
        emoji: reaction.emoji,
        user: user
          ? {
              id: user.id,
              handle: user.handle,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl ?? ''
            }
          : {
              id: reaction.userId,
              handle: 'usuario',
              displayName: 'Usuario desconocido',
              avatarUrl: ''
            },
        createdAt: reaction.createdAt.toISOString()
      };
    });

    return { reactions, counts };
  }

  /**
   * Obtiene la reacción del usuario actual a una story.
   */
  public async getUserReaction(storyId: string, userId: string): Promise<ReactionEmoji | null> {
    const reaction = await this.reactions.findByStoryIdAndUserId(storyId, userId);
    return reaction ? reaction.emoji : null;
  }

  /**
   * Elimina la reacción del usuario a una story.
   */
  public async removeReaction(storyId: string, userId: string): Promise<void> {
    const reaction = await this.reactions.findByStoryIdAndUserId(storyId, userId);
    if (!reaction) {
      throw new ApplicationError('No hay reacción para eliminar', {
        statusCode: 404,
        code: 'REACTION_NOT_FOUND'
      });
    }

    await this.reactions.delete(storyId, userId);
  }
}

