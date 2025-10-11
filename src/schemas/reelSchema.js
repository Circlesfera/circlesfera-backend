import { z } from 'zod'

export const createReelSchema = z.object({
  caption: z.string().max(2200, 'La descripción no puede exceder 2200 caracteres').optional(),
  hashtags: z.string().max(500, 'Los hashtags no pueden exceder 500 caracteres').optional(),
  location: z.string().max(100, 'La ubicación no puede exceder 100 caracteres').optional(),
  audioTitle: z.string().max(100, 'El título del audio no puede exceder 100 caracteres').optional(),
  audioArtist: z.string().max(100, 'El artista no puede exceder 100 caracteres').optional(),
  allowComments: z.boolean().optional().default(true),
  allowDuets: z.boolean().optional().default(true),
  allowStitches: z.boolean().optional().default(true)
})

export const updateReelSchema = z.object({
  caption: z.string().max(2200, 'La descripción no puede exceder 2200 caracteres').optional(),
  hashtags: z.string().max(500, 'Los hashtags no pueden exceder 500 caracteres').optional(),
  location: z.string().max(100, 'La ubicación no puede exceder 100 caracteres').optional(),
  allowComments: z.boolean().optional(),
  allowDuets: z.boolean().optional(),
  allowStitches: z.boolean().optional()
})

export const reelCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío').max(500, 'El comentario no puede exceder 500 caracteres')
})

