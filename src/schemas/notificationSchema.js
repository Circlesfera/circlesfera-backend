import { z } from 'zod'

export const createNotificationSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de usuario inválido'),
  fromUserId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de usuario que genera la notificación inválido'),
  type: z.enum([
    'follow', 'unfollow', 'like', 'comment', 'comment_like',
    'story', 'story_reply', 'reel', 'reel_like', 'reel_comment',
    'mention', 'post_share', 'account_update', 'security_alert'
  ], {
    errorMap: () => ({ message: 'Tipo de notificación no válido' })
  }),
  title: z.string().max(100, 'El título no puede exceder 100 caracteres').optional(),
  message: z.string().max(500, 'El mensaje no puede exceder 500 caracteres').optional()
})

