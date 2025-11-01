import { z } from 'zod';

const mediaSchema = z.object({
  kind: z.enum(['image', 'video']),
  url: z.string().url(),
  thumbnailUrl: z.string().url(),
  durationMs: z.number().int().positive().max(10 * 60 * 1000).optional(),
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional()
});

export const createPostSchema = z.object({
  caption: z.string().min(1).max(2_200),
  media: z.array(mediaSchema).max(10).default([])
});

export type CreatePostPayload = z.infer<typeof createPostSchema>;


