import { z } from 'zod'

/**
 * Schema de validación para registro de usuarios
 */
const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username debe tener al menos 3 caracteres')
    .max(20, 'Username no puede exceder 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username solo puede contener letras, números y guiones bajos')
    .transform(val => val.toLowerCase()),

  email: z.string()
    .email('Email inválido')
    .transform(val => val.toLowerCase()),

  password: z.string()
    .min(8, 'Password debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Password debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Password debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Password debe contener al menos un número'),

  fullName: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(50, 'Nombre no puede exceder 50 caracteres')
    .trim()
    .optional()
})

/**
 * Schema de validación para login
 */
const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email o username es requerido'),
  password: z.string()
    .min(1, 'Password es requerido')
})

/**
 * Schema de validación para actualizar perfil
 */
const updateProfileSchema = z.object({
  username: z.string()
    .min(3, 'Username debe tener al menos 3 caracteres')
    .max(20, 'Username no puede exceder 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username solo puede contener letras, números y guiones bajos')
    .optional(),

  fullName: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(50, 'Nombre no puede exceder 50 caracteres')
    .trim()
    .optional(),

  bio: z.union([
    z.string().max(160, 'Bio no puede exceder 160 caracteres').trim(),
    z.literal(''),
    z.null()
  ])
    .optional()
    .transform(val => val || ''),

  website: z.union([
    z.string().url('URL inválida'),
    z.literal(''),
    z.null()
  ])
    .optional()
    .transform(val => val || ''),

  location: z.union([
    z.string().max(100, 'Ubicación no puede exceder 100 caracteres').trim(),
    z.literal(''),
    z.null()
  ])
    .optional()
    .transform(val => val || ''),

  phone: z.union([
    z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Teléfono inválido'),
    z.literal(''),
    z.null()
  ])
    .optional()
    .transform(val => val || ''),

  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say'])
    .optional(),

  birthDate: z.union([
    z.string().refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'Fecha de nacimiento inválida' }
    ),
    z.literal(''),
    z.null(),
    z.undefined()
  ])
    .optional()
    .transform(val => val || null),

  isPrivate: z.boolean()
    .optional(),

  avatar: z.union([
    z.string().url('URL de avatar inválida'),
    z.literal(''),
    z.null()
  ])
    .optional()
})

/**
 * Schema de validación para cambio de contraseña
 */
const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Contraseña actual es requerida'),

  newPassword: z.string()
    .min(8, 'Nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Password debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Password debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Password debe contener al menos un número')
})

/**
 * Schema de validación para solicitar recuperación de contraseña
 */
const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .transform(val => val.toLowerCase())
})

/**
 * Schema de validación para restablecer contraseña
 */
const resetPasswordSchema = z.object({
  token: z.string()
    .min(1, 'Token es requerido')
    .length(64, 'Token inválido'),

  newPassword: z.string()
    .min(8, 'Nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Password debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Password debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Password debe contener al menos un número')
})

/**
 * Schema de validación para cambiar rol de usuario (solo admin)
 */
const changeRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin'], {
    errorMap: () => ({ message: 'Rol debe ser: user, moderator o admin' })
  })
})

export {
  changePasswordSchema,
  changeRoleSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema
}

