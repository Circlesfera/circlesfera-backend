import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { logger } from '@infra/logger/logger.js';
import { getSocketServer } from '@interfaces/ws/socket-server.js';
import type { NotificationRepository } from '../repositories/notification.repository.js';
import { MongoNotificationRepository } from '../repositories/notification.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';

const notificationRepository: NotificationRepository = new MongoNotificationRepository();
const userRepository: UserRepository = new MongoUserRepository();

export const notificationRouter = Router();

const notificationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  unreadOnly: z.coerce.boolean().optional()
});

notificationRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.auth.userId;
    const query = notificationQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;

    const { items, hasMore } = await notificationRepository.findByUserId({
      userId,
      limit: query.limit,
      cursor: cursorDate,
      unreadOnly: query.unreadOnly
    });

    if (items.length === 0) {
      return res.status(200).json({ data: [], nextCursor: null, unreadCount: 0 });
    }

    // Obtener actores (usuarios que generaron la notificación)
    const actorIds = Array.from(new Set(items.map((notification) => notification.actorId)));
    const actors = await userRepository.findManyByIds(actorIds);
    const actorsMap = new Map(actors.map((user) => [user.id, user]));

    // Mapear a formato de respuesta
    const data = items.map((notification) => {
      const actor = actorsMap.get(notification.actorId);
      return {
        id: notification.id,
        type: notification.type,
        actor: actor
          ? {
              id: actor.id,
              handle: actor.handle,
              displayName: actor.displayName,
              avatarUrl: actor.avatarUrl ?? ''
            }
          : null,
        postId: notification.postId,
        commentId: notification.commentId,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString()
      };
    });

    const unreadCount = await notificationRepository.countUnread(userId);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    res.status(200).json({ data, nextCursor, unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationRouter.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.auth.userId;
    const notificationId = req.params.id;

    await notificationRepository.markAsRead(notificationId, userId);

    const unreadCount = await notificationRepository.countUnread(userId);

    // Emitir actualización del contador vía WebSocket
    try {
      const io = getSocketServer();
      io.to(`user:${userId}`).emit('unread-count', { unreadCount });
    } catch (error) {
      // No fallar si Socket.IO no está disponible
      logger.warn({ err: error, userId, notificationId }, 'Error al emitir actualización de contador');
    }

    res.status(200).json({ message: 'Notificación marcada como leída', unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationRouter.post('/mark-all-read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.auth.userId;

    await notificationRepository.markAllAsRead(userId);

    // Emitir actualización del contador vía WebSocket
    try {
      const io = getSocketServer();
      io.to(`user:${userId}`).emit('unread-count', { unreadCount: 0 });
    } catch (error) {
      // No fallar si Socket.IO no está disponible
      logger.warn({ err: error, userId }, 'Error al emitir actualización de contador (mark-all-read)');
    }

    res.status(200).json({ message: 'Todas las notificaciones marcadas como leídas', unreadCount: 0 });
  } catch (error) {
    next(error);
  }
});

notificationRouter.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const userId = req.auth.userId;
    const unreadCount = await notificationRepository.countUnread(userId);

    res.status(200).json({ unreadCount });
  } catch (error) {
    next(error);
  }
});

