import type { Express, Request, Response } from 'express';

import { authRouter } from '@modules/auth/controllers/auth.controller.js';
import { userRouter } from '@modules/users/controllers/user.controller.js';
import { feedRouter } from '@modules/feed/controllers/feed.controller.js';
import { likeRouter } from '@modules/interactions/controllers/like.controller.js';
import { commentRouter } from '@modules/interactions/controllers/comment.controller.js';
import { followRouter } from '@modules/interactions/controllers/follow.controller.js';
import { saveRouter } from '@modules/interactions/controllers/save.controller.js';
import { collectionRouter } from '@modules/interactions/controllers/collection.controller.js';
import { blockRouter } from '@modules/interactions/controllers/block.controller.js';
import { analyticsRouter } from '@modules/analytics/controllers/analytics.controller.js';
import { messagingRouter } from '@modules/messaging/controllers/messaging.controller.js';
import { moderationRouter } from '@modules/moderation/controllers/moderation.controller.js';
import { notificationRouter } from '@modules/notifications/controllers/notification.controller.js';
import { storyRouter } from '@modules/stories/controllers/story.controller.js';
import { highlightRouter } from '@modules/stories/controllers/highlight.controller.js';
import { storyReactionRouter } from '@modules/stories/controllers/story-reaction.controller.js';
import { verificationRouter } from '@modules/verification/controllers/verification.controller.js';
import { mediaRouter } from '@modules/media/controllers/media.controller.js';
import { hashtagRouter } from '@modules/feed/controllers/hashtag.controller.js';
import { tagRouter } from '@modules/feed/controllers/tag.controller.js';
import { frameRouter } from '@modules/frames/controllers/frame.controller.js';

/**
 * Registra las rutas HTTP principales. Cada módulo deberá exponer un registrador
 * específico que sea importado aquí para mantener desacoplamiento.
 */
export const registerHttpRoutes = (app: Express): void => {
  // Autenticación y usuarios
  app.use('/auth', authRouter);
  app.use('/users', userRouter);

  // Feed y contenido
  app.use('/feed', feedRouter);
  app.use('/frames', frameRouter);
  app.use('/hashtags', hashtagRouter);
  app.use('/tags', tagRouter);

  // Interacciones
  app.use('/likes', likeRouter);
  app.use('/comments', commentRouter);
  app.use('/follows', followRouter);
  app.use('/saves', saveRouter);
  app.use('/collections', collectionRouter);
  app.use('/blocks', blockRouter);

  // Stories
  app.use('/stories', storyRouter);
  app.use('/highlights', highlightRouter);
  app.use('/', storyReactionRouter); // Rutas como /stories/:storyId/reactions ya incluyen el prefijo

  // Mensajería
  app.use('/messages', messagingRouter);

  // Notificaciones
  app.use('/notifications', notificationRouter);

  // Analytics
  app.use('/analytics', analyticsRouter);

  // Moderation
  app.use('/reports', moderationRouter);

  // Verificación
  app.use('/verification', verificationRouter);

  // Media
  app.use('/media', mediaRouter);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });
};

