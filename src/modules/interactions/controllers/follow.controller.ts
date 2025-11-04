import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { logger } from '@infra/logger/logger.js';
import { NotificationService } from '@modules/notifications/services/notification.service.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { FollowRepository } from '../repositories/follow.repository.js';
import { MongoFollowRepository } from '../repositories/follow.repository.js';

const followRepository: FollowRepository = new MongoFollowRepository();
const userRepository: UserRepository = new MongoUserRepository();
const notificationService = new NotificationService();

export const followRouter = Router();

followRouter.post('/:handle/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const followerId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    if (followerId === targetUser.id) {
      throw new ApplicationError('No puedes seguirte a ti mismo', {
        statusCode: 400,
        code: 'CANNOT_FOLLOW_SELF'
      });
    }

    const alreadyFollowing = await followRepository.exists(followerId, targetUser.id);
    if (alreadyFollowing) {
      return res.status(200).json({ message: 'Ya sigues a este usuario', following: true });
    }

    await followRepository.create(followerId, targetUser.id);

    // Generar notificación para el usuario seguido
    await notificationService.createNotification({
      type: 'follow',
      actorId: followerId,
      userId: targetUser.id
    }).catch((err) => {
      // No fallar si la notificación no se puede crear
      logger.warn({ err, followerId, targetUserId: targetUser.id }, 'Error al crear notificación de follow');
    });

    res.status(201).json({ message: 'Ahora sigues a este usuario', following: true });
  } catch (error) {
    next(error);
  }
});

followRouter.delete('/:handle/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const followerId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    await followRepository.delete(followerId, targetUser.id);

    res.status(200).json({ message: 'Dejaste de seguir a este usuario', following: false });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:handle/followers
 * Obtiene la lista de seguidores de un usuario con paginación.
 */
followRouter.get('/:handle/followers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const targetHandle = req.params.handle.toLowerCase();
    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
    const cursor = req.query.cursor as string | undefined;
    const searchQuery = req.query.q as string | undefined;

    // Obtener IDs de seguidores
    let followerIds = await followRepository.findFollowerIds(targetUser.id);

    // Búsqueda por query si se proporciona
    if (searchQuery) {
      const searchResults = await userRepository.searchUsers({
        query: searchQuery,
        limit: 1000 // Obtener muchos para filtrar
      });
      const searchUserIds = new Set(searchResults.map((u) => u.id));
      followerIds = followerIds.filter((id) => searchUserIds.has(id));
    }

    // Aplicar paginación
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = followerIds.indexOf(cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedIds = followerIds.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < followerIds.length 
      ? (paginatedIds[paginatedIds.length - 1] ?? null)
      : null;

    // Obtener datos de usuarios
    const users = await userRepository.findManyByIds(paginatedIds);

    res.status(200).json({
      users: users.map((user) => ({
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        bio: user.bio ?? null,
        isVerified: false, // TODO: Agregar verificación cuando exista
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:handle/following
 * Obtiene la lista de usuarios que sigue un usuario con paginación.
 */
followRouter.get('/:handle/following', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const targetHandle = req.params.handle.toLowerCase();
    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
    const cursor = req.query.cursor as string | undefined;
    const searchQuery = req.query.q as string | undefined;

    // Obtener IDs de usuarios que sigue
    let followingIds = await followRepository.findFollowingIds(targetUser.id);

    // Búsqueda por query si se proporciona
    if (searchQuery) {
      const searchResults = await userRepository.searchUsers({
        query: searchQuery,
        limit: 1000
      });
      const searchUserIds = new Set(searchResults.map((u) => u.id));
      followingIds = followingIds.filter((id) => searchUserIds.has(id));
    }

    // Aplicar paginación
    let paginatedIds = followingIds;
    let nextCursor: string | null = null;

    if (cursor) {
      const cursorIndex = followingIds.indexOf(cursor);
      if (cursorIndex !== -1) {
        paginatedIds = followingIds.slice(cursorIndex + 1);
      }
    }

    paginatedIds = paginatedIds.slice(0, limit);
    
    if (paginatedIds.length < followingIds.length) {
      const lastIndex = followingIds.indexOf(paginatedIds[paginatedIds.length - 1]);
      if (lastIndex !== -1 && lastIndex < followingIds.length - 1) {
        nextCursor = followingIds[lastIndex + 1] ?? null;
      }
    }

    // Obtener datos de usuarios
    const users = await userRepository.findManyByIds(paginatedIds);

    res.status(200).json({
      users: users.map((user) => ({
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        bio: user.bio ?? null,
        isVerified: false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })),
      nextCursor
    });
  } catch (error) {
    next(error);
  }
});

