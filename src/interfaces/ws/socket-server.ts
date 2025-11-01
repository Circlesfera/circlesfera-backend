import type { Server as HttpServer } from 'node:http';

import { Server as SocketIOServer } from 'socket.io';
import type { DisconnectReason, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from '@config/index.js';
import { getRedisClient, getRedisSubscriber } from '@infra/cache/redis/connection.js';
import { logger } from '@infra/logger/logger.js';

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

  return io;
};

