import { z } from 'zod'

export const createStorySchema = z.object({
  type: z.enum(['image', 'video'], {
    errorMap: () => ({ message: 'El tipo debe ser image o video' })
  }),
  caption: z.string().max(500, 'La descripción no puede exceder 500 caracteres').optional(),
  duration: z.number().min(1).max(60, 'La duración debe estar entre 1 y 60 segundos').optional(),
  location: z.string().max(100, 'La ubicación no puede exceder 100 caracteres').optional()
})

