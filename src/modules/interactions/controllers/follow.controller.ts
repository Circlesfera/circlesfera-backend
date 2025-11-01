import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { FollowRepository } from '../repositories/follow.repository.js';
import { MongoFollowRepository } from '../repositories/follow.repository.js';

const followRepository: FollowRepository = new MongoFollowRepository();
const userRepository: UserRepository = new MongoUserRepository();

export const followRouter = Router();

followRouter.post('/:handle/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const followerId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    if (followerId === targetUser.id) {
      throw new ApplicationError('No puedes seguirte a ti mismo', {
        statusCode: 400,
        code: 'CANNOT_FOLLOW_SELF'
      });
    }

    const alreadyFollowing = await followRepository.exists(followerId, targetUser.id);
    if (alreadyFollowing) {
      return res.status(200).json({ message: 'Ya sigues a este usuario', following: true });
    }

    await followRepository.create(followerId, targetUser.id);

    res.status(201).json({ message: 'Ahora sigues a este usuario', following: true });
  } catch (error) {
    next(error);
  }
});

followRouter.delete('/:handle/follow', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const followerId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    await followRepository.delete(followerId, targetUser.id);

    res.status(200).json({ message: 'Dejaste de seguir a este usuario', following: false });
  } catch (error) {
    next(error);
  }
});

