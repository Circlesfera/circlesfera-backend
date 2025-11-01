import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    displayName: z.string().min(2).max(64).optional(),
    bio: z.string().max(160).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional()
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'Debes proporcionar al menos un campo para actualizar'
  });

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;

