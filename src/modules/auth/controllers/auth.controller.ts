import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

import { env } from '@config/index.js';
import { ApplicationError } from '@core/errors/application-error.js';
import { authRateLimiter } from '@interfaces/http/middlewares/rate-limiter.js';

import { registerSchema } from '../dtos/register.dto.js';
import { loginSchema } from '../dtos/login.dto.js';
import { AuthService } from '../services/auth.service.js';
import { authenticate } from '@interfaces/http/middlewares/auth.js';

const authService = new AuthService();

const refreshCookieName = 'circlesfera_session';

const cookieSettings = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN,
  path: '/',
  maxAge: env.JWT_REFRESH_TOKEN_TTL * 1000
};

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(refreshCookieName, token, cookieSettings);
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    path: '/'
  });
};

const requireRefreshCookie = (req: Request): string => {
  const refreshToken = req.cookies?.[refreshCookieName];
  if (!refreshToken) {
    throw new ApplicationError('No se encontró refresh token', {
      statusCode: 401,
      code: 'REFRESH_TOKEN_NOT_FOUND'
    });
  }
  return refreshToken;
};

export const authRouter = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar un nuevo usuario
 *     description: Crea una nueva cuenta de usuario en CircleSfera
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - displayName
 *               - handle
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@ejemplo.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: password123
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 64
 *                 example: Juan Pérez
 *               handle:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 32
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 example: juanperez
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       409:
 *         description: Email o handle ya está en uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       422:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
authRouter.post('/register', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(payload);

    setRefreshCookie(res, result.tokens.refreshToken);

    res.status(201).json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     description: Autentica un usuario y devuelve tokens de acceso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@ejemplo.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
authRouter.post('/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload);

    setRefreshCookie(res, result.tokens.refreshToken);

    res.status(200).json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = requireRefreshCookie(req);
    const tokens = await authService.refresh(refreshToken);

    setRefreshCookie(res, tokens.refreshToken);

    res.status(200).json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.[refreshCookieName];
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    clearRefreshCookie(res);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApplicationError('Token de acceso requerido', {
        statusCode: 401,
        code: 'ACCESS_TOKEN_REQUIRED'
      });
    }

    const user = await authService.getProfile(req.auth.userId);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

