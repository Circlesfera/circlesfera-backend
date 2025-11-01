import { z } from 'zod';

export const homeFeedQuerySchema = z.object({
  cursor: z
    .string()
    .min(1)
    .optional(),
  limit: z.coerce.number().int().positive().max(50).default(20)
});

export type HomeFeedQuery = z.infer<typeof homeFeedQuerySchema>;


