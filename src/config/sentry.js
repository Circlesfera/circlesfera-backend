const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const { config } = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Inicializar Sentry para monitoring de errores
 * @param {Express} app - Instancia de Express
 * @returns {Object|null} Sentry instance o null si no está configurado
 */
const initSentry = (app) => {
  const sentryDsn = process.env.SENTRY_DSN;

  // Solo inicializar en producción y si está configurado
  if (!config.isProduction || !sentryDsn) {
    if (config.isDevelopment) {
      logger.info('Sentry disabled in development');
    }
    return null;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.nodeEnv,

      // Performance Monitoring
      tracesSampleRate: config.isProduction ? 0.1 : 1.0, // 10% en prod, 100% en dev

      // Profiling
      profilesSampleRate: 0.1, // 10% de las transacciones

      // Integrations
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({
          app,
          tracing: true,
        }),
        new Sentry.Integrations.Mongo({
          useMongoose: true,
        }),
        new ProfilingIntegration(),
      ],

      // Filtrar información sensible
      beforeSend(event, _hint) {
        // No enviar información de passwords
        if (event.request && event.request.data) {
          if (event.request.data.password) {
            event.request.data.password = '[FILTERED]';
          }
          if (event.request.data.currentPassword) {
            event.request.data.currentPassword = '[FILTERED]';
          }
          if (event.request.data.newPassword) {
            event.request.data.newPassword = '[FILTERED]';
          }
        }

        return event;
      },

      // Ignorar ciertos errores
      ignoreErrors: [
        'ECONNRESET',
        'EPIPE',
        'ETIMEDOUT',
      ],
    });

    logger.info('✅ Sentry inicializado correctamente');

    return Sentry;
  } catch (error) {
    logger.error('Error inicializando Sentry:', error);
    return null;
  }
};

/**
 * Capturar excepción manualmente
 */
const captureException = (error, context = {}) => {
  if (config.isProduction) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    logger.error('Exception captured:', error, context);
  }
};

/**
 * Capturar mensaje personalizado
 */
const captureMessage = (message, level = 'info', context = {}) => {
  if (config.isProduction) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  } else {
    logger[level](message, context);
  }
};

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  Sentry,
};

