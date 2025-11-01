import type { Express, Request, Response } from 'express';

import { authRouter } from '@modules/auth/controllers/auth.controller.js';
import { feedRouter } from '@modules/feed/controllers/feed.controller.js';
import { commentRouter } from '@modules/interactions/controllers/comment.controller.js';
import { followRouter } from '@modules/interactions/controllers/follow.controller.js';
import { likeRouter } from '@modules/interactions/controllers/like.controller.js';
import { userRouter } from '@modules/users/controllers/user.controller.js';

/**
 * Registra las rutas HTTP principales. Cada módulo deberá exponer un registrador
 * específico que sea importado aquí para mantener desacoplamiento.
 */
export const registerHttpRoutes = (app: Express): void => {
  app.use('/auth', authRouter);
  app.use('/users', userRouter);
  app.use('/feed', feedRouter);
  app.use('/users', followRouter);
  app.use('/', likeRouter);
  app.use('/', commentRouter);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // TODO: registrar rutas de auth, usuarios, feed, etc.
};

