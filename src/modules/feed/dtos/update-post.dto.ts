import { z } from 'zod';

export const updatePostSchema = z.object({
  caption: z.string().min(1).max(2_200)
});

export type UpdatePostPayload = z.infer<typeof updatePostSchema>;

