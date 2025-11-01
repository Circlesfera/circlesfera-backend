import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '@config/index.js';
import { ApplicationError } from '@core/errors/application-error.js';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    throw new ApplicationError('Token de acceso requerido', {
      statusCode: 401,
      code: 'ACCESS_TOKEN_REQUIRED'
    });
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApplicationError('Encabezado de autorización inválido', {
      statusCode: 401,
      code: 'INVALID_AUTH_HEADER'
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_TOKEN_SECRET);
    if (typeof decoded !== 'object' || typeof decoded.sub !== 'string') {
      throw new ApplicationError('Token inválido', {
        statusCode: 401,
        code: 'INVALID_ACCESS_TOKEN'
      });
    }

    req.auth = { userId: decoded.sub };
    next();
  } catch (error) {
    throw new ApplicationError('Token inválido o expirado', {
      statusCode: 401,
      code: 'INVALID_ACCESS_TOKEN',
      cause: error as Error
    });
  }
};

