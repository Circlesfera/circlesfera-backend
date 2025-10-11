import { z } from 'zod'

export const createConversationSchema = z.object({
  participants: z.array(z.string()).min(1, 'Debe haber al menos un participante').max(50, 'Máximo 50 participantes'),
  isGroup: z.boolean().optional().default(false),
  name: z.string().max(100, 'El nombre no puede exceder 100 caracteres').optional()
})

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'ID de conversación requerido'),
  content: z.string().max(5000, 'El mensaje no puede exceder 5000 caracteres').optional(),
  type: z.enum(['text', 'image', 'video', 'audio', 'file'], {
    errorMap: () => ({ message: 'Tipo de mensaje inválido' })
  }).default('text')
})

