import 'reflect-metadata';

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import { env } from '@config/index.js';
import { connectMongo } from '@infra/db/mongo/connection.js';
import { getRedisClient, getRedisSubscriber } from '@infra/cache/redis/connection.js';
import { logger } from '@infra/logger/logger.js';
import { initSentry } from '@infra/monitoring/sentry.config.js';
import { createHttpApp } from '@interfaces/http/server.js';
import { createSocketServer } from '@interfaces/ws/socket-server.js';

// Inicializar Sentry ANTES que cualquier otra cosa
initSentry();

/**
 * Arranca la aplicación conectando dependencias críticas (MongoDB, Redis) y levantando
 * los servidores HTTP/WebSocket. Devuelve handles útiles para pruebas e integración.
 */
export const bootstrap = async (): Promise<void> => {
  await connectMongo();
  getRedisClient();
  getRedisSubscriber();

  const expressApp = createHttpApp();
  const httpServer = createServer(expressApp);

  createSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Servidor HTTP iniciado');
  });
};

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  bootstrap().catch((error) => {
    logger.fatal({ err: error }, 'Fallo crítico al iniciar la aplicación');
    process.exitCode = 1;
  });
}

