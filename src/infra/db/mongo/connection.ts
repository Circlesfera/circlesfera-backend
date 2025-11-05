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
    
    // Configurar eventos de conexión para mejor logging
    mongoose.connection.on('error', (error) => {
      logger.error({ err: error }, 'Error en la conexión de MongoDB');
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB desconectado');
      connectionPromise = null;
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconectado');
    });

    connectionPromise = mongoose.connect(env.MONGO_URI, {
      dbName: env.MONGO_DB_NAME,
      maxPoolSize: 20,
      minPoolSize: 5,
      autoIndex: env.NODE_ENV !== 'production',
      // Timeouts para evitar conexiones colgadas
      serverSelectionTimeoutMS: 30000, // 30 segundos para seleccionar servidor
      socketTimeoutMS: 45000, // 45 segundos para operaciones
      connectTimeoutMS: 30000, // 30 segundos para conexión inicial
      // Retry automático
      retryWrites: true,
      retryReads: true,
      // Configuración para MongoDB Atlas
      ...(env.MONGO_URI.includes('mongodb+srv://') && {
        // Opciones adicionales para Atlas
        heartbeatFrequencyMS: 10000,
        maxIdleTimeMS: 30000
      })
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

