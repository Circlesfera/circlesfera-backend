import '@core/init.js';

import { createServer } from 'http';

import { env } from '@config/index.js';
import { connectMongo } from '@infra/db/mongo/connection.js';
import { getRedisClient, getRedisSubscriber } from '@infra/cache/redis/connection.js';
import { logger } from '@infra/logger/logger.js';
import { createHttpApp } from '@interfaces/http/server.js';
import { createSocketServer } from '@interfaces/ws/socket-server.js';

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

// This block ensures bootstrap is called only when app.ts is executed directly
// and not when imported as a module.
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  bootstrap().catch((error) => {
    logger.fatal({ err: error }, 'Fallo crítico al iniciar la aplicación');
    process.exitCode = 1;
  });
}

