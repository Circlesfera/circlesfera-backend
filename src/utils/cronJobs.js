const cron = require('node-cron');
const { exec } = require('child_process');
const logger = require('./logger');
const { config } = require('./config');
const Story = require('../models/Story');

/**
 * Configurar todos los cron jobs de la aplicación
 */
const setupCronJobs = () => {
  // Solo ejecutar cron jobs en producción o si está explícitamente habilitado
  const enableCron = config.isProduction || process.env.ENABLE_CRON_JOBS === 'true';

  if (!enableCron) {
    logger.info('Cron jobs deshabilitados en desarrollo');
    return;
  }

  logger.info('⏰ Configurando cron jobs...');

  // 1. Limpiar historias expiradas - cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    try {
      logger.info('Ejecutando limpieza de historias expiradas...');

      const result = await Story.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      if (result.deletedCount > 0) {
        logger.info(`✅ ${result.deletedCount} historias expiradas eliminadas`);
      }
    } catch (error) {
      logger.error('Error limpiando historias:', error);
    }
  });

  // 2. Backup automático - diario a las 2 AM
  if (process.env.ENABLE_AUTO_BACKUP === 'true') {
    cron.schedule('0 2 * * *', () => {
      logger.info('Iniciando backup automático diario...');
      exec('node scripts/backup-db.js', (error, stdout, stderr) => {
        if (error) {
          logger.error('Error en backup automático:', error);
          return;
        }
        logger.info('Backup automático completado');
        if (stdout) logger.info(stdout);
        if (stderr) logger.error(stderr);
      });
    });
  }

  // 3. Limpiar tokens expirados de blacklist (si se implementa)
  cron.schedule('0 */6 * * *', () => {
    logger.info('Limpiando tokens expirados...');
    // Implementar cuando se agregue blacklist de tokens
  });

  // 4. Generar estadísticas diarias - cada día a las 1 AM
  cron.schedule('0 1 * * *', async () => {
    try {
      logger.info('Generando estadísticas diarias...');
      // Aquí se pueden agregar estadísticas personalizadas
      // Ej: usuarios activos, posts creados, etc.
    } catch (error) {
      logger.error('Error generando estadísticas:', error);
    }
  });

  // 5. Limpiar logs antiguos - semanal los domingos a las 3 AM
  cron.schedule('0 3 * * 0', () => {
    logger.info('Limpiando logs antiguos...');
    exec('find logs -name "*.log" -mtime +30 -delete', (error) => {
      if (error) {
        logger.error('Error limpiando logs:', error);
      } else {
        logger.info('Logs antiguos eliminados');
      }
    });
  });

  logger.info('✅ Cron jobs configurados:');
  logger.info('  - Limpieza de historias: cada 15 minutos');
  logger.info('  - Backup automático: diario a las 2 AM (si está habilitado)');
  logger.info('  - Limpieza de tokens: cada 6 horas');
  logger.info('  - Estadísticas: diario a la 1 AM');
  logger.info('  - Limpieza de logs: semanal los domingos');
};

module.exports = setupCronJobs;

