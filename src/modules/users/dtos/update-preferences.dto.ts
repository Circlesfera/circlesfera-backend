import { z } from 'zod';

export const updatePreferencesSchema = z
  .object({
    // Privacidad
    isPrivate: z.boolean().optional(),
    showActivityStatus: z.boolean().optional(),
    whoCanComment: z.enum(['everyone', 'followers', 'nobody']).optional(),
    whoCanMention: z.enum(['everyone', 'followers', 'nobody']).optional(),

    // Notificaciones
    notificationsLikes: z.boolean().optional(),
    notificationsComments: z.boolean().optional(),
    notificationsFollows: z.boolean().optional(),
    notificationsMentions: z.boolean().optional(),
    notificationsReplies: z.boolean().optional(),
    notificationsTags: z.boolean().optional(),
    notificationsShares: z.boolean().optional(),

    // Aplicación
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.enum(['es', 'en']).optional()
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Debes proporcionar al menos un campo para actualizar'
  });

export type UpdatePreferencesPayload = z.infer<typeof updatePreferencesSchema>;

