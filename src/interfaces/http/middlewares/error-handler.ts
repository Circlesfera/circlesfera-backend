import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';

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
    // Errores de autenticación esperados que no requieren logging
    const silentAuthErrors = [
      'SESSION_NOT_FOUND',
      'REFRESH_TOKEN_NOT_FOUND',
      'INVALID_ACCESS_TOKEN',
      'ACCESS_TOKEN_REQUIRED',
      'INVALID_AUTH_HEADER'
    ];

    // Errores 404 esperados (recursos no encontrados que son normales)
    const silentNotFoundErrors = ['USER_NOT_FOUND', 'POST_NOT_FOUND', 'STORY_NOT_FOUND'];

    // Errores de servicios externos (se loguean como warnings)
    const externalServiceErrors = ['STORAGE_SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE'];

    if (silentAuthErrors.includes(error.code)) {
      // Estos errores son esperados y no requieren logging
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        metadata: error.metadata
      });
      return;
    }

    if (error.statusCode === 404 && silentNotFoundErrors.includes(error.code)) {
      // Errores 404 de recursos comunes no requieren logging
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        metadata: error.metadata
      });
      return;
    }

    if (externalServiceErrors.includes(error.code)) {
      // Errores de servicios externos se loguean como warnings
      logger.warn(
        { code: error.code, metadata: error.metadata, cause: error.cause },
        'Servicio externo no disponible'
      );
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
        metadata: error.metadata
      });
      return;
    }

    // Otros errores controlados se loguean como warning
    logger.warn(
      { code: error.code, metadata: error.metadata, cause: error.cause },
      'Error controlado'
    );

    // Capturar errores 5xx en Sentry
    if (error.statusCode >= 500) {
      Sentry.captureException(error, {
        contexts: {
          application: {
            code: error.code,
            metadata: error.metadata
          }
        }
      });
    }

    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      metadata: error.metadata
    });
    return;
  }

  // Detectar errores de servicios externos (DNS, conexión, etc.)
  if (error instanceof Error) {
    const isExternalServiceError =
      (error as Error & { code?: string; errno?: number; syscall?: string }).code === 'ENOTFOUND' ||
      (error as Error & { code?: string; errno?: number; syscall?: string }).code === 'ECONNREFUSED' ||
      (error as Error & { code?: string; errno?: number; syscall?: string }).code === 'ETIMEDOUT' ||
      (error as Error & { code?: string; errno?: number; syscall?: string }).syscall === 'getaddrinfo';

    if (isExternalServiceError) {
      // Errores de servicios externos se loguean como warnings (servicio no disponible)
      logger.warn(
        {
          err: error,
          code: (error as Error & { code?: string }).code,
          hostname: (error as Error & { hostname?: string }).hostname
        },
        'Error de conexión con servicio externo'
      );

      res.status(503).json({
        code: 'SERVICE_UNAVAILABLE',
        message: 'El servicio de almacenamiento no está disponible temporalmente'
      });
      return;
    }
  }

  logger.error({ err: error }, 'Error no controlado');

  // Capturar error desconocido en Sentry
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)));

  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: isDevelopment
      ? error instanceof Error
        ? error.message
        : 'Error desconocido'
      : 'Ha ocurrido un error interno. Por favor, intenta más tarde.',
    ...(isDevelopment && error instanceof Error && { stack: error.stack })
  });
};

