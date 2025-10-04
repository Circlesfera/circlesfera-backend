const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { config } = require('../utils/config');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check completo del sistema
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Sistema saludable
 *       503:
 *         description: Sistema con problemas
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    requestId: req.id,
    checks: {},
  };

  // Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    if (mongoState === 1) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - start;

      health.checks.mongodb = {
        status: 'up',
        responseTime: `${responseTime}ms`,
        state: stateMap[mongoState],
      };
    } else {
      health.checks.mongodb = {
        status: 'down',
        state: stateMap[mongoState],
      };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.mongodb = {
      status: 'down',
      error: error.message,
    };
    health.status = 'degraded';
    logger.error('MongoDB health check failed:', error);
  }

  // Check Memory
  const memUsage = process.memoryUsage();
  const memoryThreshold = 0.9; // 90%
  const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;

  health.checks.memory = {
    status: memoryUsagePercent > memoryThreshold ? 'warning' : 'ok',
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    usagePercent: `${(memoryUsagePercent * 100).toFixed(2)}%`,
  };

  if (memoryUsagePercent > memoryThreshold) {
    health.status = 'degraded';
  }

  // Response time
  if (req.startTime) {
    health.responseTime = `${Date.now() - req.startTime}ms`;
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * @swagger
 * /api/health/live:
 *   get:
 *     summary: Liveness probe - verificar que el proceso está vivo
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Servicio vivo
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Readiness probe - verificar que el servicio está listo
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Servicio listo
 *       503:
 *         description: Servicio no está listo
 */
router.get('/ready', async (req, res) => {
  try {
    // Verificar MongoDB
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'MongoDB not connected',
      });
    }

    // Verificar que podemos hacer queries
    await mongoose.connection.db.admin().ping();

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      reason: error.message,
    });
  }
});

module.exports = router;

