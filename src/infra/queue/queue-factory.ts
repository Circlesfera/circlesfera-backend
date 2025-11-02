import {
  Queue,
  QueueEvents,
  type QueueEventsOptions,
  type QueueOptions,
  type ConnectionOptions
} from 'bullmq';

import { env } from '@config/index.js';
import { logger } from '@infra/logger/logger.js';

const connection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential'
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
};

const eventsOptions: QueueEventsOptions = {
  connection
};

/**
 * Factoría para crear colas BullMQ consistentes. Devuelve la pareja `Queue` + `QueueEvents`
 * para manejar procesamiento asíncrono y emisión de eventos.
 */
export const createQueue = <Payload>(name: string): {
  queue: Queue<Payload>;
  events: QueueEvents;
} => {
  const queue = new Queue<Payload>(name, queueOptions);
  const events = new QueueEvents(name, eventsOptions);

  // Agregar handlers de error para evitar warnings
  queue.on('error', (error: Error) => {
    logger.error({ err: error, queueName: name }, 'Error en cola BullMQ');
  });

  events.on('error', (error: Error) => {
    logger.error({ err: error, queueName: name }, 'Error en eventos de cola BullMQ');
  });

  return { queue, events };
};

