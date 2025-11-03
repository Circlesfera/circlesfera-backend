import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { env } from '@config/index.js';

import { globalErrorHandler } from './middlewares/error-handler.js';
import { registerHttpRoutes } from './routes/index.js';
import { swaggerSpec } from './swagger.config.js';

/**
 * Crea y configura la aplicación Express aplicando middlewares de seguridad, parsing
 * y observabilidad. Las rutas de negocio se registran a través de `registerHttpRoutes`.
 */
export const createHttpApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(
    cors({
      origin: [env.CLIENT_APP_URL],
      credentials: true
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limiting general aplicado a todas las rutas (fallback)
  // Las rutas específicas tienen sus propios rate limiters más restrictivos
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false
    })
  );

  // Swagger UI solo en desarrollo
  if (env.NODE_ENV !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'CircleSfera API Documentation'
    }));
  }

  registerHttpRoutes(app);

  app.use(globalErrorHandler);

  return app;
};

