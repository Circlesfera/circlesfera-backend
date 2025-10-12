import { z } from 'zod'

// Schema para crear un reporte
export const createReportSchema = z.object({
  contentType: z.enum(
    ['post', 'reel', 'story', 'comment', 'user', 'live_stream', 'message'],
    {
      required_error: 'El tipo de contenido es requerido',
      invalid_type_error: 'Tipo de contenido inválido'
    }
  ),

  contentId: z
    .string({
      required_error: 'El ID del contenido es requerido'
    })
    .regex(/^[0-9a-fA-F]{24}$/, 'ID de contenido inválido'),

  reason: z.enum(
    [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'false_information',
      'copyright',
      'suicide_or_self_harm',
      'scam',
      'terrorism',
      'other'
    ],
    {
      required_error: 'La razón del reporte es requerida',
      invalid_type_error: 'Razón de reporte inválida'
    }
  ),

  description: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional()
})

// Schema para actualizar estado de reporte (admin/moderador)
export const updateReportStatusSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed'], {
    required_error: 'El estado es requerido'
  }),

  action: z
    .enum(['none', 'warning', 'content_removed', 'user_banned', 'user_suspended'])
    .optional(),

  moderatorNotes: z
    .string()
    .max(1000, 'Las notas no pueden exceder 1000 caracteres')
    .optional()
})

// Schema para filtros de búsqueda de reportes
export const reportFiltersSchema = z.object({
  status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']).optional(),
  contentType: z
    .enum(['post', 'reel', 'story', 'comment', 'user', 'live_stream', 'message'])
    .optional(),
  reason: z
    .enum([
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'false_information',
      'copyright',
      'suicide_or_self_harm',
      'scam',
      'terrorism',
      'other'
    ])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

