import mongoose from 'mongoose';

import { env } from '@config/index.js';
import { logger } from '@infra/logger/logger.js';

let connectionPromise: Promise<typeof mongoose> | null = null;

/**
 * Establece una conexión singleton con MongoDB usando Mongoose. Evita múltiples
 * conexiones simultáneas y permite reutilizar la misma conexión en todo el proceso.
 */
export const connectMongo = async (): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return mongoose;
  }

  if (!connectionPromise) {
    mongoose.set('strictQuery', true);
    connectionPromise = mongoose.connect(env.MONGO_URI, {
      dbName: env.MONGO_DB_NAME,
      maxPoolSize: 20,
      minPoolSize: 5,
      autoIndex: env.NODE_ENV !== 'production'
    });

    connectionPromise
      .then(() => {
        logger.info({ dbName: env.MONGO_DB_NAME }, 'Conexión a MongoDB establecida');
      })
      .catch((error) => {
        logger.error({ err: error }, 'Error al conectar con MongoDB');
        connectionPromise = null;
      });
  }

  return connectionPromise;
};

/**
 * Cierra la conexión activa de Mongoose. Utilizado en pruebas y apagado ordenado.
 */
export const disconnectMongo = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('Conexión a MongoDB cerrada');
  }
  connectionPromise = null;
};

