const { z } = require('zod');

/**
 * Schema de validación para crear post
 */
const createPostSchema = z.object({
  type: z.enum(['image', 'video'], {
    errorMap: () => ({ message: 'Tipo debe ser "image" o "video"' }),
  }),

  caption: z.string()
    .max(2200, 'Caption no puede exceder 2200 caracteres')
    .trim()
    .optional()
    .default(''),

  location: z.string()
    .max(100, 'Ubicación no puede exceder 100 caracteres')
    .trim()
    .optional(),

  tags: z.array(z.string().max(50, 'Tag no puede exceder 50 caracteres'))
    .max(30, 'Máximo 30 tags')
    .optional()
    .default([]),
});

/**
 * Schema de validación para actualizar post
 */
const updatePostSchema = z.object({
  caption: z.string()
    .max(2200, 'Caption no puede exceder 2200 caracteres')
    .trim()
    .optional(),

  location: z.string()
    .max(100, 'Ubicación no puede exceder 100 caracteres')
    .trim()
    .optional(),

  tags: z.array(z.string().max(50))
    .max(30, 'Máximo 30 tags')
    .optional(),
});

/**
 * Schema de validación para comentarios
 */
const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'El comentario no puede estar vacío')
    .max(500, 'Comentario no puede exceder 500 caracteres')
    .trim(),

  parentComment: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'ID de comentario padre inválido')
    .optional(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
};

