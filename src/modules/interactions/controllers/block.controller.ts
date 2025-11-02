import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import { MongoUserRepository } from '@modules/users/repositories/user.repository.js';
import type { BlockRepository } from '../repositories/block.repository.js';
import { MongoBlockRepository } from '../repositories/block.repository.js';
import type { FollowRepository } from '../repositories/follow.repository.js';
import { MongoFollowRepository } from '../repositories/follow.repository.js';

const blockRepository: BlockRepository = new MongoBlockRepository();
const userRepository: UserRepository = new MongoUserRepository();
const followRepository: FollowRepository = new MongoFollowRepository();

export const blockRouter = Router();

blockRouter.post('/:handle/block', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const blockerId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    if (blockerId === targetUser.id) {
      throw new ApplicationError('No puedes bloquearte a ti mismo', {
        statusCode: 400,
        code: 'CANNOT_BLOCK_SELF'
      });
    }

    const alreadyBlocked = await blockRepository.exists(blockerId, targetUser.id);
    if (alreadyBlocked) {
      return res.status(200).json({ message: 'Ya tienes bloqueado a este usuario', blocked: true });
    }

    // Eliminar follow si existe (en ambas direcciones)
    await Promise.all([
      followRepository.delete(blockerId, targetUser.id).catch(() => {
        // Ignorar si no existe
      }),
      followRepository.delete(targetUser.id, blockerId).catch(() => {
        // Ignorar si no existe
      })
    ]);

    await blockRepository.create(blockerId, targetUser.id);

    res.status(201).json({ message: 'Usuario bloqueado exitosamente', blocked: true });
  } catch (error) {
    next(error);
  }
});

blockRouter.delete('/:handle/block', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const blockerId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    await blockRepository.delete(blockerId, targetUser.id);

    res.status(200).json({ message: 'Usuario desbloqueado exitosamente', blocked: false });
  } catch (error) {
    next(error);
  }
});

blockRouter.get('/:handle/block-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const currentUserId = req.auth.userId;
    const targetHandle = req.params.handle.toLowerCase();

    const targetUser = await userRepository.findByHandle(targetHandle);
    if (!targetUser) {
      throw new ApplicationError('Usuario no encontrado', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      });
    }

    const { user1BlocksUser2, user2BlocksUser1 } = await blockRepository.findMutualBlocks(currentUserId, targetUser.id);

    res.status(200).json({
      isBlocked: user1BlocksUser2,
      hasBlockedYou: user2BlocksUser1,
      canInteract: !user1BlocksUser2 && !user2BlocksUser1
    });
  } catch (error) {
    next(error);
  }
});

