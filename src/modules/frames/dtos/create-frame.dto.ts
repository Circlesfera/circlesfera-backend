import { z } from 'zod';

const frameMediaSchema = z.object({
  kind: z.literal('video'),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  durationMs: z.number().int().positive().max(60_000),
  width: z.number().int().positive().max(10_000).optional(),
  height: z.number().int().positive().max(10_000).optional(),
  rotation: z.number().int().min(0).max(359).optional()
});

export const createFrameSchema = z.object({
  caption: z.string().max(2_200).default(''),
  media: z.array(frameMediaSchema).length(1)
});

export type CreateFramePayload = z.infer<typeof createFrameSchema>;
