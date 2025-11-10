import { z } from 'zod';

const urlOrEmpty = z
  .string()
  .url()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const mediaSchema = z.object({
  kind: z.enum(['image', 'video']),
  url: z.string().url(),
  thumbnailUrl: urlOrEmpty,
  durationMs: z.number().int().positive().max(10 * 60 * 1000).optional(),
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional(),
  rotation: z.number().int().min(0).max(359).optional()
});

export const createPostSchema = z.object({
  caption: z.string().min(1).max(2_200),
  media: z.array(mediaSchema).max(10).default([])
});

export type CreatePostPayload = z.infer<typeof createPostSchema>;


