import { z } from 'zod';

const storyMediaSchema = z.object({
  kind: z.enum(['image', 'video']),
  url: z.string().url(),
  thumbnailUrl: z.string().url(),
  durationMs: z.number().int().positive().max(60 * 1000).optional(), // Máximo 60 segundos para stories
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional()
});

export const createStorySchema = z.object({
  media: storyMediaSchema,
  sharedPostId: z.string().min(1).optional() // ID del post a compartir (opcional)
});

export type CreateStoryPayload = z.infer<typeof createStorySchema>;

