import { z } from 'zod'

export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'El comentario no puede estar vacío')
    .max(2200, 'El comentario no puede exceder 2200 caracteres'),
  postId: z.string().optional(),
  parentComment: z.string().optional()
})

export const updateCommentSchema = z.object({
  content: z.string()
    .min(1, 'El comentario no puede estar vacío')
    .max(2200, 'El comentario no puede exceder 2200 caracteres')
})

