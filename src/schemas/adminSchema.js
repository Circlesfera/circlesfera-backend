import { z } from 'zod'

// Esquema para cambiar rol de usuario
export const adminUserSchema = z.object({
  body: z.object({
    role: z.enum(['user', 'moderator', 'admin'], {
      errorMap: () => ({ message: 'El rol debe ser user, moderator o admin' })
    })
  })
})

// Esquema para banear usuario
export const banUserSchema = z.object({
  body: z.object({
    reason: z.string()
      .min(1, 'La razón del ban es requerida')
      .max(500, 'La razón no puede exceder 500 caracteres'),
    duration: z.number()
      .int('La duración debe ser un número entero')
      .min(1, 'La duración mínima es 1 día')
      .max(365, 'La duración máxima es 365 días')
      .optional()
  })
})

// Esquema para suspender usuario
export const suspendUserSchema = z.object({
  body: z.object({
    reason: z.string()
      .min(1, 'La razón de la suspensión es requerida')
      .max(500, 'La razón no puede exceder 500 caracteres'),
    duration: z.number()
      .int('La duración debe ser un número entero')
      .min(1, 'La duración mínima es 1 día')
      .max(30, 'La duración máxima es 30 días')
  })
})

// Esquema para parámetros de consulta de usuarios
export const adminUsersQuerySchema = z.object({
  query: z.object({
    page: z.string()
      .optional()
      .transform((val) => val ? parseInt(val, 10) : 1)
      .refine((val) => val > 0, 'La página debe ser mayor a 0'),

    limit: z.string()
      .optional()
      .transform((val) => val ? parseInt(val, 10) : 20)
      .refine((val) => val > 0 && val <= 100, 'El límite debe estar entre 1 y 100'),

    search: z.string()
      .optional()
      .transform((val) => val?.trim() || ''),

    role: z.enum(['user', 'moderator', 'admin'])
      .optional(),

    status: z.enum(['active', 'banned', 'suspended'])
      .optional(),

    sortBy: z.enum([
      'createdAt',
      'username',
      'email',
      'role',
      'postsCount',
      'followersCount',
      'lastLoginAt'
    ])
      .optional()
      .default('createdAt'),

    sortOrder: z.enum(['asc', 'desc'])
      .optional()
      .default('desc')
  })
})

// Esquema para parámetros de usuario
export const userIdParamsSchema = z.object({
  params: z.object({
    userId: z.string()
      .min(1, 'El ID del usuario es requerido')
      .regex(/^[0-9a-fA-F]{24}$/, 'ID de usuario inválido')
  })
})

// Esquema para filtros de reportes
export const adminReportsQuerySchema = z.object({
  query: z.object({
    page: z.string()
      .optional()
      .transform((val) => val ? parseInt(val, 10) : 1)
      .refine((val) => val > 0, 'La página debe ser mayor a 0'),

    limit: z.string()
      .optional()
      .transform((val) => val ? parseInt(val, 10) : 20)
      .refine((val) => val > 0 && val <= 100, 'El límite debe estar entre 1 y 100'),

    status: z.enum(['pending', 'under_review', 'resolved', 'rejected'])
      .optional(),

    reason: z.string()
      .optional(),

    contentType: z.enum(['post', 'reel', 'story', 'comment', 'user', 'message'])
      .optional(),

    sortBy: z.enum(['createdAt', 'updatedAt', 'status'])
      .optional()
      .default('createdAt'),

    sortOrder: z.enum(['asc', 'desc'])
      .optional()
      .default('desc')
  })
})

// Esquema para actualizar estado de reporte
export const updateReportStatusSchema = z.object({
  params: z.object({
    reportId: z.string()
      .min(1, 'El ID del reporte es requerido')
      .regex(/^[0-9a-fA-F]{24}$/, 'ID de reporte inválido')
  }),
  body: z.object({
    status: z.enum(['pending', 'under_review', 'resolved', 'rejected'], {
      errorMap: () => ({ message: 'El estado debe ser pending, under_review, resolved o rejected' })
    }),
    adminNotes: z.string()
      .max(1000, 'Las notas no pueden exceder 1000 caracteres')
      .optional()
  })
})
