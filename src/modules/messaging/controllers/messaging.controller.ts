import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { ApplicationError } from '@core/errors/application-error.js';
import { authenticate } from '@interfaces/http/middlewares/auth.js';
import { MessagingService } from '../services/messaging.service.js';

const messagingService = new MessagingService();

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000)
});

const createConversationSchema = z.object({
  userId: z.string().min(1)
});

export const messagingRouter = require('express').Router();

/**
 * GET /conversations
 * Obtiene todas las conversaciones del usuario autenticado.
 */
messagingRouter.get('/conversations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const conversations = await messagingService.getConversations(req.auth.userId);

    res.status(200).json({ conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /conversations
 * Crea o encuentra una conversación entre el usuario autenticado y otro usuario.
 */
messagingRouter.post('/conversations', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const payload = createConversationSchema.parse(req.body);
    const conversationId = await messagingService.findOrCreateConversation(req.auth.userId, payload.userId);

    res.status(200).json({ id: conversationId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        new ApplicationError('Datos inválidos', {
          statusCode: 400,
          code: 'INVALID_INPUT',
          metadata: { errors: error.errors }
        })
      );
    }
    next(error);
  }
});

/**
 * GET /conversations/:id/messages
 * Obtiene los mensajes de una conversación con paginación.
 */
messagingRouter.get('/conversations/:id/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const conversationId = req.params.id;
    const limitParam = req.query.limit ? Number(req.query.limit) : 50;
    const limit = Math.min(Math.max(1, limitParam), 100);
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : undefined;

    const result = await messagingService.getMessages(conversationId, req.auth.userId, limit, cursor);

    res.status(200).json({
      messages: result.messages,
      nextCursor: result.nextCursor
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /conversations/:id/messages
 * Envía un mensaje a una conversación.
 */
messagingRouter.post('/conversations/:id/messages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ code: 'ACCESS_TOKEN_REQUIRED', message: 'Token requerido' });
    }

    const conversationId = req.params.id;
    const payload = sendMessageSchema.parse(req.body);

    const message = await messagingService.sendMessage(conversationId, req.auth.userId, payload.content);

    res.status(201).json({ message });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(
        new ApplicationError('Datos inválidos', {
          statusCode: 400,
          code: 'INVALID_INPUT',
          metadata: { errors: error.errors }
        })
      );
    }
    if (error instanceof Error && error.message === 'Conversación no encontrada') {
      return next(
        new ApplicationError('Conversación no encontrada', {
          statusCode: 404,
          code: 'CONVERSATION_NOT_FOUND'
        })
      );
    }
    if (error instanceof Error && error.message.includes('No puedes enviar mensajes')) {
      return next(
        new ApplicationError('No tienes permiso para enviar mensajes a esta conversación', {
          statusCode: 403,
          code: 'FORBIDDEN'
        })
      );
    }
    next(error);
  }
});

