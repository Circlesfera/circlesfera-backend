import * as Sentry from '@sentry/node';
import { env } from '@config/index.js';

/**
 * Inicializa Sentry para error tracking y performance monitoring.
 * Solo se inicializa si SENTRY_DSN está configurado.
 * 
 * Nota: Profiling está deshabilitado temporalmente debido a problemas de compatibilidad
 * con @sentry/profiling-node. El error tracking y performance monitoring básico siguen funcionando.
 */
export const initSentry = (): void => {
  if (!env.SENTRY_DSN || env.SENTRY_DSN.trim() === '') {
    return; // Sentry no configurado, continuar sin él
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Performance monitoring
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% en producción, 100% en desarrollo
    // Release tracking (puede ser el commit SHA en CI/CD)
    release: process.env.APP_VERSION || undefined,
    // Ignorar errores esperados
    ignoreErrors: [
      'SESSION_NOT_FOUND',
      'REFRESH_TOKEN_NOT_FOUND',
      'INVALID_ACCESS_TOKEN',
      'ACCESS_TOKEN_REQUIRED',
      'USER_NOT_FOUND',
      'POST_NOT_FOUND',
      'STORY_NOT_FOUND'
    ]
  });
};

/**
 * Captura un error en Sentry.
 */
export const captureException = (error: Error, context?: Record<string, Record<string, unknown>>): void => {
  if (context) {
    Sentry.withScope((scope: any) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
};

/**
 * Captura un mensaje en Sentry.
 */
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info'): void => {
  Sentry.captureMessage(message, level);
};

