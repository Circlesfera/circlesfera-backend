import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';

import { updateProfileSchema } from '../dtos/update-profile.dto.js';
import { changePasswordSchema } from '../dtos/change-password.dto.js';
import { UserService } from '../services/user.service.js';

const userService = new UserService();

export const userRouter = Router();

userRouter.get('/search', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string) ?? '';
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 20;
    
    const users = await userService.searchUsers({ query, limit });
    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
});

userRouter.get('/:handle/posts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const handle = req.params.handle;
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 20;
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : undefined;

    const result = await userService.getUserPosts(handle, req.auth.userId, limit, cursor);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/:handle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getPublicProfile(req.params.handle);
    res.status(200).json({ user: profile });
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

userRouter.patch('/me/password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = changePasswordSchema.parse(req.body);
    await userService.changePassword(req.auth.userId, payload);
    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    if (error instanceof ApplicationError) {
      next(error);
    } else {
      next(error);
    }
  }
});

userRouter.delete('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    await userService.deleteAccount(req.auth.userId);
    res.status(200).json({ message: 'Cuenta eliminada exitosamente' });
  } catch (error) {
    next(error);
  }
});

