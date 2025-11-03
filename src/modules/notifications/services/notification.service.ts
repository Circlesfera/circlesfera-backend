import { getSocketServer } from '@interfaces/ws/socket-server.js';
import { logger } from '@infra/logger/logger.js';

import type { NotificationRepository } from '../repositories/notification.repository.js';
import { MongoNotificationRepository } from '../repositories/notification.repository.js';
import type { NotificationType } from '../models/notification.model.js';

export interface NotificationPayload {
  type: NotificationType;
  actorId: string;
  userId: string;
  postId?: string;
  commentId?: string;
}

export class NotificationService {
  public constructor(private readonly repository: NotificationRepository = new MongoNotificationRepository()) {}

  /**
   * Crea una notificación si no existe una similar reciente.
   * Evita spam de notificaciones (ej: no notificar cada like de la misma persona).
   * Emite la notificación en tiempo real vía WebSocket.
   */
  public async createNotification(payload: NotificationPayload): Promise<void> {
    // Evitar auto-notificaciones
    if (payload.userId === payload.actorId) {
      return;
    }

    // TODO: Implementar deduplicación temporal (ej: no crear nueva notificación
    // si existe una del mismo tipo del mismo actor en los últimos X minutos)
    const notification = await this.repository.create({
      userId: payload.userId,
      type: payload.type,
      actorId: payload.actorId,
      postId: payload.postId,
      commentId: payload.commentId
    });

    // Emitir notificación en tiempo real
    try {
      const io = getSocketServer();
      io.to(`user:${payload.userId}`).emit('notification', {
        id: notification.id,
        type: notification.type,
        actorId: notification.actorId,
        postId: notification.postId,
        commentId: notification.commentId,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString()
      });

      // También emitir actualización del contador
      const unreadCount = await this.repository.countUnread(payload.userId);
      io.to(`user:${payload.userId}`).emit('unread-count', { unreadCount });
    } catch (error) {
      // No fallar si Socket.IO no está disponible
      logger.warn({ err: error, type: payload.type, userId: payload.userId, actorId: payload.actorId }, 'Error al emitir notificación vía WebSocket');
    }
  }

  /**
   * Crea múltiples notificaciones en batch (útil para eventos masivos).
   */
  public async createBatchNotifications(payloads: NotificationPayload[]): Promise<void> {
    const validPayloads = payloads.filter((p) => p.userId !== p.actorId);

    await Promise.all(
      validPayloads.map((payload) =>
        this.repository.create({
          userId: payload.userId,
          type: payload.type,
          actorId: payload.actorId,
          postId: payload.postId,
          commentId: payload.commentId
        })
      )
    );
  }
}

