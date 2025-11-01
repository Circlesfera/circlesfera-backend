import { pino, type LoggerOptions, type TransportMultiOptions } from 'pino';

import { env } from '@config/index.js';

/**
 * Crea una instancia compartida de logger basada en Pino. En desarrollo se habilita
 * un transporte "pretty" para facilitar la lectura, mientras que en producción se
 * emiten logs JSON listos para ingesta en sistemas de observabilidad.
 */
const createTransport = (): TransportMultiOptions | undefined => {
  if (env.NODE_ENV !== 'development') {
    return undefined;
  }

  return {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l'
        }
      }
    ]
  } satisfies TransportMultiOptions;
};

const options: LoggerOptions = {
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: createTransport(),
  base: {
    service: 'circlesfera-backend'
  }
};

export const logger = pino(options);

