import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

/**
 * Carga los archivos `.env` relevantes según el `NODE_ENV` y valida las variables
 * de entorno obligatorias. El objetivo es centralizar la configuración y prevenir
 * ejecuciones con parámetros inseguros o incompletos.
 */
const resolveEnvFiles = (): string[] => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const candidates = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env'
  ];

  return candidates
    .map((fileName) => resolve(process.cwd(), fileName))
    .filter((absolutePath) => existsSync(absolutePath));
};

resolveEnvFiles().forEach((path) => {
  loadEnv({ path, override: true });
});

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal(''))
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url(),
  CLIENT_APP_URL: z.string().url(),
  MONGO_URI: z.string().min(1, 'MONGO_URI es obligatorio'),
  MONGO_DB_NAME: z.string().min(1, 'MONGO_DB_NAME es obligatorio'),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST es obligatorio'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z
    .enum(['require', 'disable'])
    .optional()
    .transform((value) => (value === 'require' ? true : undefined)),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1, 'S3_REGION es obligatorio'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY es obligatorio'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY es obligatorio'),
  S3_BUCKET_MEDIA: z.string().min(1, 'S3_BUCKET_MEDIA es obligatorio'),
  JWT_ACCESS_TOKEN_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_TOKEN_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_TOKEN_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_TOKEN_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800),
  COOKIE_DOMAIN: z.string().min(1, 'COOKIE_DOMAIN es obligatorio'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  FFMPEG_CONCURRENCY: z.coerce.number().int().positive().default(2),
  SENTRY_DSN: optionalUrl,
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.errors
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Variables de entorno inválidas:\n${formattedErrors}`);
}

/**
 * Configuración validada del entorno de ejecución.
 */
export const env = parsedEnv.data;

export type AppEnv = typeof env;

