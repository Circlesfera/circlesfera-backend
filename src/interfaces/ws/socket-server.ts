import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';

import { Server as SocketIOServer } from 'socket.io';
import type { DisconnectReason, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from '@config/index.js';
import { getRedisClient, getRedisSubscriber } from '@infra/cache/redis/connection.js';
import { logger } from '@infra/logger/logger.js';

// Variable global para almacenar la instancia de io
let ioInstance: SocketIOServer | null = null;

/**
 * Inicializa el servidor de Socket.IO acoplándolo al servidor HTTP compartido.
 * Utiliza Redis como adaptador para soportar escalado horizontal.
 */
export const createSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_APP_URL,
      credentials: true
    }
  });

  const publisher = getRedisClient().duplicate();
  const subscriber = getRedisSubscriber().duplicate();

  io.adapter(createAdapter(publisher, subscriber));

  // Middleware de autenticación para Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Token de acceso requerido'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_TOKEN_SECRET);
      if (typeof decoded !== 'object' || typeof decoded.sub !== 'string') {
        return next(new Error('Token inválido'));
      }

      (socket as Socket & { userId: string }).userId = decoded.sub;
      next();
    } catch (error) {
      logger.warn({ error }, 'Error al autenticar socket');
      return next(new Error('Token inválido o expirado'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as Socket & { userId: string }).userId;

    // Unirse a la sala del usuario para recibir notificaciones
    socket.join(`user:${userId}`);

    logger.info({ socketId: socket.id, userId }, 'Cliente conectado a Socket.IO');

    socket.on('disconnect', (reason: DisconnectReason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Cliente desconectado de Socket.IO');
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Obtiene la instancia de Socket.IO para emitir eventos.
 * Debe ser llamado después de createSocketServer.
 */
export const getSocketServer = (): SocketIOServer => {
  if (!ioInstance) {
    throw new Error('Socket.IO server no ha sido inicializado. Llama a createSocketServer primero.');
  }
  return ioInstance;
};

