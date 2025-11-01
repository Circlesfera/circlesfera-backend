import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@interfaces/http/middlewares/auth.js';

import { updateProfileSchema } from '../dtos/update-profile.dto.js';
import { UserService } from '../services/user.service.js';

const userService = new UserService();

export const userRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().positive().max(50).optional().default(20)
});

const postsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20)
});

userRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = searchQuerySchema.parse(req.query);
    const users = await userService.searchUsers(query.q, query.limit);
    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/:handle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getPublicProfile(req.params.handle);
    const stats = await userService.getUserStats(profile.id);
    res.status(200).json({ user: profile, stats });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/:handle/posts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getPublicProfile(req.params.handle);
    const query = postsQuerySchema.parse(req.query);
    const cursorDate = query.cursor ? new Date(query.cursor) : undefined;

    const { items, hasMore } = await userService.getUserPosts(profile.id, query.limit, cursorDate);

    if (items.length === 0) {
      return res.status(200).json({ data: [], nextCursor: null });
    }

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    res.status(200).json({ data: items, nextCursor });
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = updateProfileSchema.parse(req.body);
    const profile = await userService.updateProfile(req.auth.userId, payload);
    res.status(200).json({ user: profile });
  } catch (error) {
    next(error);
  }
});

