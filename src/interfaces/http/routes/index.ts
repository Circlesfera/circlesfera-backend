import type { Express, Request, Response } from 'express';

import { authRouter } from '@modules/auth/controllers/auth.controller.js';
import { feedRouter } from '@modules/feed/controllers/feed.controller.js';
import { hashtagRouter } from '@modules/feed/controllers/hashtag.controller.js';
import { tagRouter } from '@modules/feed/controllers/tag.controller.js';
import { mediaRouter } from '@modules/media/controllers/media.controller.js';
import { blockRouter } from '@modules/interactions/controllers/block.controller.js';
import { commentRouter } from '@modules/interactions/controllers/comment.controller.js';
import { followRouter } from '@modules/interactions/controllers/follow.controller.js';
import { likeRouter } from '@modules/interactions/controllers/like.controller.js';
import { collectionRouter } from '@modules/interactions/controllers/collection.controller.js';
import { saveRouter } from '@modules/interactions/controllers/save.controller.js';
import { notificationRouter } from '@modules/notifications/controllers/notification.controller.js';
import { messagingRouter } from '@modules/messaging/controllers/messaging.controller.js';
import { moderationRouter } from '@modules/moderation/controllers/moderation.controller.js';
import { analyticsRouter } from '@modules/analytics/controllers/analytics.controller.js';
import { highlightRouter } from '@modules/stories/controllers/highlight.controller.js';
import { storyRouter } from '@modules/stories/controllers/story.controller.js';
import { storyReactionRouter } from '@modules/stories/controllers/story-reaction.controller.js';
import { verificationRouter } from '@modules/verification/controllers/verification.controller.js';
import { userRouter } from '@modules/users/controllers/user.controller.js';

/**
 * Registra las rutas HTTP principales. Cada módulo deberá exponer un registrador
 * específico que sea importado aquí para mantener desacoplamiento.
 */
export const registerHttpRoutes = (app: Express): void => {
  app.use('/auth', authRouter);
  app.use('/users', userRouter);
  app.use('/feed', feedRouter);
  app.use('/hashtags', hashtagRouter);
  app.use('/', tagRouter);
  app.use('/media', mediaRouter);
  app.use('/users', followRouter);
  app.use('/users', blockRouter);
  app.use('/', likeRouter);
  app.use('/', commentRouter);
  app.use('/', saveRouter);
  app.use('/collections', collectionRouter);
  app.use('/notifications', notificationRouter);
  app.use('/messages', messagingRouter);
  app.use('/', moderationRouter);
  app.use('/stories', storyRouter);
  app.use('/', storyReactionRouter);
  app.use('/highlights', highlightRouter);
  app.use('/analytics', analyticsRouter);
  app.use('/verification', verificationRouter);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // TODO: registrar rutas de auth, usuarios, feed, etc.
};

