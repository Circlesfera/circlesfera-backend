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
    // Códigos de error que son esperados y no deberían loguearse como warnings
    // especialmente durante recargas del servidor o peticiones no autenticadas
    const silentErrorCodes = [
      'ACCESS_TOKEN_REQUIRED',
      'SESSION_NOT_FOUND',
      'INVALID_ACCESS_TOKEN',
      'INVALID_REFRESH_TOKEN',
      'REFRESH_TOKEN_NOT_FOUND',
      'INVALID_AUTH_HEADER'
    ];

    // Solo loguear como WARN si no es un error esperado
    if (!silentErrorCodes.includes(error.code)) {
      // Para USER_NOT_FOUND, solo loguear si el status code es 404 y no es de un endpoint público
      if (error.code === 'USER_NOT_FOUND' && error.statusCode === 404) {
        // Solo loguear como debug/info, no como warning
        logger.debug(
          { code: error.code, metadata: error.metadata },
          'Usuario no encontrado'
        );
      } else {
    logger.warn(
      { code: error.code, metadata: error.metadata, cause: error.cause },
      'Error controlado'
    );
      }
    }

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

