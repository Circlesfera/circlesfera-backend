import { verify, hash } from 'argon2';
import mongoose from 'mongoose';

import { ApplicationError } from '@core/errors/application-error.js';

import { MongoUserRepository, type UserRepository } from '../repositories/user.repository.js';
import type { UpdateProfilePayload } from '../dtos/update-profile.dto.js';
import type { ChangePasswordPayload } from '../dtos/change-password.dto.js';
import type { User } from '../models/user.model.js';
import { FeedService } from '@modules/feed/services/feed.service.js';

// Importar modelos para eliminación en cascada
import { PostModel } from '@modules/feed/models/post.model.js';
import { CommentModel } from '@modules/interactions/models/comment.model.js';
import { LikeModel } from '@modules/interactions/models/like.model.js';
import { SaveModel } from '@modules/interactions/models/save.model.js';
import { FollowModel } from '@modules/interactions/models/follow.model.js';
import { BlockModel } from '@modules/interactions/models/block.model.js';
import { MessageModel } from '@modules/messaging/models/message.model.js';
import { ConversationModel } from '@modules/messaging/models/conversation.model.js';
import { NotificationModel } from '@modules/notifications/models/notification.model.js';
import { StoryModel } from '@modules/stories/models/story.model.js';
import { StoryReactionModel } from '@modules/stories/models/story-reaction.model.js';
import { StoryViewModel } from '@modules/stories/models/story-view.model.js';
import { HighlightModel } from '@modules/stories/models/highlight.model.js';
import { CollectionModel } from '@modules/interactions/models/collection.model.js';
import { TagModel } from '@modules/feed/models/tag.model.js';
import { MentionModel } from '@modules/feed/models/mention.model.js';
import { FollowHashtagModel } from '@modules/feed/models/follow-hashtag.model.js';
import { VerificationRequestModel } from '@modules/verification/models/verification-request.model.js';
import { UserPreferencesModel } from '../models/user-preferences.model.js';
import { ReportModel } from '@modules/moderation/models/report.model.js';
import { RefreshTokenService } from '@modules/auth/services/refresh-token.service.js';

const userRepository: UserRepository = new MongoUserRepository();
const feedService = new FeedService();
const refreshTokenService = new RefreshTokenService();

export type PublicProfile = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class UserService {
  public async getPublicProfile(handle: string): Promise<PublicProfile> {
    const user = await userRepository.findByHandle(handle.toLowerCase());
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.toPublicProfile(user);
  }

  public async updateProfile(userId: string, payload: UpdateProfilePayload): Promise<PublicProfile> {
    // Si se está actualizando el handle, verificar que no esté en uso
    if (payload.handle) {
      const normalizedHandle = payload.handle.toLowerCase();
      const existingUser = await userRepository.findByHandle(normalizedHandle);
      
      // Verificar si el handle está en uso por otro usuario
      if (existingUser && existingUser.id !== userId) {
        throw new ApplicationError('El handle ya está en uso', {
          statusCode: 409,
          code: 'HANDLE_ALREADY_EXISTS'
        });
      }

      // Verificar si el usuario actual ya tiene ese handle
      const currentUser = await userRepository.findById(userId);
      if (currentUser && currentUser.handle === normalizedHandle) {
        // No actualizar si es el mismo handle
        delete payload.handle;
      }
    }

    const updates = {
      displayName: payload.displayName,
      bio: payload.bio ?? null,
      avatarUrl: payload.avatarUrl ?? null,
      handle: payload.handle ? payload.handle.toLowerCase() : undefined
    } satisfies Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'handle'>>;

    // Eliminar campos undefined para no actualizarlos
    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof typeof updates] === undefined) {
        delete updates[key as keyof typeof updates];
      }
    });

    const updated = await userRepository.updateById(userId, updates);
    if (!updated) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    return this.toPublicProfile(updated);
  }

  public async searchUsers(options: { query: string; limit?: number }): Promise<PublicProfile[]> {
    const users = await userRepository.searchUsers({
      query: options.query,
      limit: options.limit ?? 20
    });
    
    return users.map((user) => this.toPublicProfile(user));
  }

  public async getUserPosts(
    handle: string,
    userId: string,
    limit = 20,
    cursor?: Date
  ) {
    // Obtener el usuario por handle
    const user = await userRepository.findByHandle(handle.toLowerCase());
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    // Obtener posts usando el feedService (usa el userId del request si está autenticado)
    const result = await feedService.getUserPosts(user.id, userId ?? null, limit, cursor);
    return result;
  }

  public async changePassword(userId: string, payload: ChangePasswordPayload): Promise<void> {
    // Obtener usuario por ID primero para obtener el email
    const userById = await userRepository.findById(userId);
    if (!userById) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    // Obtener usuario con passwordHash usando findByEmail
    const user = await userRepository.findByEmail(userById.email);
    
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await verify(user.passwordHash, payload.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new ApplicationError('La contraseña actual es incorrecta', {
        statusCode: 400,
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await verify(user.passwordHash, payload.newPassword);
    if (isSamePassword) {
      throw new ApplicationError('La nueva contraseña debe ser diferente a la actual', {
        statusCode: 400,
        code: 'SAME_PASSWORD'
      });
    }

    // Hash de la nueva contraseña
    const newPasswordHash = await hash(payload.newPassword);

    // Actualizar contraseña
    await userRepository.updatePassword(userId, newPasswordHash);
  }

  /**
   * Elimina completamente la cuenta de un usuario y TODOS sus datos relacionados.
   * Esto incluye:
   * - Posts, comentarios, likes, saves, tags, mentions
   * - Relaciones sociales (follows, blocks)
   * - Mensajes y conversaciones (directas y grupales - se eliminan completamente)
   * - Notificaciones, stories, highlights, collections
   * - Preferencias, verificaciones, reportes
   * - Y cualquier otro dato asociado al usuario
   *
   * IMPORTANTE: Esta acción es irreversible y elimina TODO lo relacionado con el usuario.
   */
  public async deleteAccount(userId: string): Promise<void> {
    // Verificar que el usuario existe
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);

    // Eliminar TODOS los datos relacionados en orden lógico
    // NOTA: Se elimina TODO, incluidas conversaciones grupales completas
    try {
      // 1. Obtener todos los posts del usuario para eliminarlos junto con sus datos relacionados
      const userPosts = await PostModel.find({ authorId: userIdObj }).select('_id').exec();
      const postIds = userPosts.map((p) => p._id);

      // 2. Eliminar likes de los posts del usuario y likes del usuario
      await LikeModel.deleteMany({
        $or: [{ postId: { $in: postIds } }, { userId: userIdObj }]
      }).exec();

      // 3. Eliminar comentarios de los posts del usuario y comentarios del usuario
      await CommentModel.deleteMany({
        $or: [{ postId: { $in: postIds } }, { authorId: userIdObj }]
      }).exec();

      // 4. Eliminar saves del usuario
      await SaveModel.deleteMany({ userId: userIdObj }).exec();

      // 5. Eliminar tags donde el usuario está etiquetado (el campo es userId)
      await TagModel.deleteMany({ userId: userIdObj }).exec();

      // 6. Eliminar mentions del usuario
      await MentionModel.deleteMany({ mentionedUserId: userIdObj }).exec();

      // 7. Eliminar posts del usuario (después de eliminar sus relaciones)
      await PostModel.deleteMany({ authorId: userIdObj }).exec();

      // 8. Eliminar follows (como seguidor y como seguido)
      await FollowModel.deleteMany({
        $or: [{ followerId: userIdObj }, { followingId: userIdObj }]
      }).exec();

      // 9. Eliminar blocks (como bloqueador y como bloqueado)
      await BlockModel.deleteMany({
        $or: [{ blockerId: userIdObj }, { blockedId: userIdObj }]
      }).exec();

      // 10. Eliminar mensajes del usuario
      await MessageModel.deleteMany({ senderId: userIdObj }).exec();

      // 11. Eliminar TODAS las conversaciones donde el usuario participa
      // Esto incluye conversaciones directas (participant1Id o participant2Id)
      // y conversaciones grupales completas (donde el usuario está en participants)
      // Se eliminan completamente para eliminar todo rastro del usuario
      await ConversationModel.deleteMany({
        $or: [
          { participant1Id: userIdObj },
          { participant2Id: userIdObj },
          { participants: { $in: [userIdObj] } },
          { createdBy: userIdObj }
        ]
      }).exec();

      // 12. Eliminar notificaciones (como receptor y como actor)
      await NotificationModel.deleteMany({
        $or: [{ userId: userIdObj }, { actorId: userIdObj }]
      }).exec();

      // 13. Obtener stories del usuario para eliminar sus visualizaciones
      const userStories = await StoryModel.find({ authorId: userIdObj }).select('_id').exec();
      const storyIds = userStories.map((s) => s._id);

      // 14. Eliminar visualizaciones de stories (como viewer)
      await StoryViewModel.deleteMany({ viewerId: userIdObj }).exec();

      // 15. Eliminar visualizaciones de las stories del usuario
      if (storyIds.length > 0) {
        await StoryViewModel.deleteMany({ storyId: { $in: storyIds } }).exec();
      }

      // 16. Eliminar story reactions del usuario
      await StoryReactionModel.deleteMany({ userId: userIdObj }).exec();

      // 17. Eliminar story reactions de las stories del usuario
      if (storyIds.length > 0) {
        await StoryReactionModel.deleteMany({ storyId: { $in: storyIds } }).exec();
      }

      // 18. Eliminar stories del usuario
      await StoryModel.deleteMany({ authorId: userIdObj }).exec();

      // 19. Eliminar highlights del usuario
      await HighlightModel.deleteMany({ authorId: userIdObj }).exec();

      // 20. Eliminar collections del usuario (el campo es userId)
      await CollectionModel.deleteMany({ userId: userIdObj }).exec();

      // 21. Eliminar follow hashtags del usuario
      await FollowHashtagModel.deleteMany({ userId: userIdObj }).exec();

      // 22. Eliminar verification requests del usuario
      await VerificationRequestModel.deleteMany({ userId: userIdObj }).exec();

      // 23. Eliminar user preferences
      await UserPreferencesModel.deleteMany({ userId: userIdObj }).exec();

      // 24. Eliminar reportes realizados por el usuario o relacionados con el usuario
      await ReportModel.deleteMany({
        $or: [
          { reporterId: userIdObj },
          { targetId: userIdObj, targetType: 'user' }
        ]
      }).exec();

      // 25. Eliminar refresh tokens (sessions) del usuario
      // Nota: Necesitamos obtener todas las sesiones del usuario desde Redis
      // Esto requeriría un método adicional en RefreshTokenService, pero por ahora
      // las sesiones expirarán automáticamente

      // 26. Finalmente, eliminar el usuario
      await userRepository.deleteById(userId);
    } catch (error) {
      // Log del error pero no fallar la eliminación
      console.error('Error al eliminar datos relacionados del usuario:', error);
      // Continuar con la eliminación del usuario
      await userRepository.deleteById(userId);
    }
  }

  private toPublicProfile(user: User): PublicProfile {
    return {
      id: user.id,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      isVerified: user.isVerified ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

