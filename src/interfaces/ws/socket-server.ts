import type { Server as HttpServer } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';
import type { DisconnectReason, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from '@config/index.js';
import { getRedisClient, getRedisSubscriber } from '@infra/cache/redis/connection.js';
import { logger } from '@infra/logger/logger.js';

let socketServerInstance: SocketIOServer | null = null;

/**
 * Obtiene la instancia singleton del servidor Socket.IO.
 * @throws Error si el servidor no ha sido inicializado
 */
export const getSocketServer = (): SocketIOServer => {
  if (!socketServerInstance) {
    throw new Error('Socket.IO server not initialized. Call createSocketServer first.');
  }
  return socketServerInstance;
};

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

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Cliente conectado a Socket.IO');

    socket.on('disconnect', (reason: DisconnectReason) => {
      logger.info({ socketId: socket.id, reason }, 'Cliente desconectado de Socket.IO');
    });
  });

  // Guardar la instancia para acceso singleton
  socketServerInstance = io;

  return io;
};

