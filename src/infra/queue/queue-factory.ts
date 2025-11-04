import {
  Queue,
  QueueEvents,
  type QueueEventsOptions,
  type QueueOptions,
  type ConnectionOptions
} from 'bullmq';

import { env } from '@config/index.js';

const connection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD
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

  return { queue, events };
};

