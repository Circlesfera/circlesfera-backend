import { z } from 'zod'

export const createNotificationSchema = z.object({
  user: z.string().min(1, 'Usuario requerido'),
  type: z.enum(['like', 'comment', 'follow', 'mention', 'post', 'story', 'reel', 'message'], {
    errorMap: () => ({ message: 'Tipo de notificación inválido' })
  }),
  fromUser: z.string().optional(),
  content: z.string().max(500, 'El contenido no puede exceder 500 caracteres'),
  relatedContent: z.object({
    type: z.enum(['post', 'story', 'reel', 'comment', 'user']),
    id: z.string()
  }).optional()
})

