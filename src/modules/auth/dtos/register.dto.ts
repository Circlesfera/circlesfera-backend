import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(64),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'El handle solo puede contener letras, números y guiones bajos')
});

export type RegisterPayload = z.infer<typeof registerSchema>;

