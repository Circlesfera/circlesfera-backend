import { z } from 'zod'

// Schema para crear post
export const createPostSchema = z.object({
  type: z.enum(['image', 'video'], {
    errorMap: () => ({ message: 'El tipo debe ser image o video' })
  }),
  caption: z.string().max(2200, 'La descripción no puede exceder 2200 caracteres').optional(),
  location: z.string().max(100, 'La ubicación no puede exceder 100 caracteres').optional(),
  tags: z.string().max(500, 'Los tags no pueden exceder 500 caracteres').optional()
})

// Schema para actualizar post
export const updatePostSchema = z.object({
  caption: z.string().max(2200, 'La descripción no puede exceder 2200 caracteres').optional(),
  location: z.string().max(100, 'La ubicación no puede exceder 100 caracteres').optional(),
  tags: z.string().max(500, 'Los tags no pueden exceder 500 caracteres').optional()
})
