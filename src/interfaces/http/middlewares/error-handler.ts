import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { ApplicationError } from '@core/errors/application-error.js';
import { logger } from '@infra/logger/logger.js';

/**
 * Middleware global de captura de errores para la capa HTTP. Normaliza la respuesta
 * serializando errores controlados de dominio y previniendo filtración de detalles
 * internos en producción.
 */
export const globalErrorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    res.status(422).json({
      code: 'VALIDATION_ERROR',
      message: 'La petición contiene datos inválidos',
      issues: error.errors
    });
    return;
  }

  if (error instanceof ApplicationError) {
    logger.warn(
      { code: error.code, metadata: error.metadata, cause: error.cause },
      'Error controlado'
    );

    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      metadata: error.metadata
    });
    return;
  }

  logger.error({ err: error }, 'Error no controlado');

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Ha ocurrido un error inesperado'
  });
};

