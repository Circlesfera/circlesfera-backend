/**
 * Setup global para tests
 */

import { jest, afterAll } from '@jest/globals';

// Forzar variables de entorno para tests
// SOBRESCRIBIR valores existentes de .env para garantizar consistencia en tests
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/circlesfera-test';
process.env.MONGO_DB_NAME = 'circlesfera-test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY = 'test-key';
process.env.S3_SECRET_KEY = 'test-secret';
process.env.S3_BUCKET_MEDIA = 'test-bucket';
process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret-min-16-characters';
process.env.JWT_REFRESH_TOKEN_SECRET = 'test-refresh-secret-min-16-characters';
process.env.JWT_ACCESS_TOKEN_TTL = '900';
process.env.JWT_REFRESH_TOKEN_TTL = '604800';
process.env.COOKIE_DOMAIN = 'localhost';
process.env.COOKIE_SECURE = 'false';
process.env.API_URL = 'http://localhost:4000';
process.env.CLIENT_APP_URL = 'http://localhost:3000';

// Mock de isomorphic-dompurify para evitar problemas con ESM en tests
jest.mock('isomorphic-dompurify', () => ({
  default: {
    sanitize: jest.fn((html: string) => html)
  },
  sanitize: jest.fn((html: string) => html)
}));

// Mock de @config/index para tests con valores fijos y consistentes
jest.mock('@config/index', () => ({
  env: {
    NODE_ENV: 'test' as const,
    PORT: 4000,
    API_URL: 'http://localhost:4000',
    CLIENT_APP_URL: 'http://localhost:3000',
    MONGO_URI: 'mongodb://localhost:27017/circlesfera-test',
    MONGO_DB_NAME: 'circlesfera-test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'test-key',
    S3_SECRET_KEY: 'test-secret',
    S3_BUCKET_MEDIA: 'test-bucket',
    JWT_ACCESS_TOKEN_SECRET: 'test-access-secret-min-16-characters',
    JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret-min-16-characters',
    JWT_ACCESS_TOKEN_TTL: 900,
    JWT_REFRESH_TOKEN_TTL: 604800,
    COOKIE_DOMAIN: 'localhost',
    COOKIE_SECURE: false,
    FFMPEG_CONCURRENCY: 2,
    SENTRY_DSN: undefined,
    OTEL_EXPORTER_OTLP_ENDPOINT: undefined
  }
}));

// Stub de Redis para evitar conexiones reales y fugas de handles
jest.mock('@infra/cache/redis/connection', () => {
  const store = new Map<string, string>();
  
  return {
    getRedisClient: () => ({
      set: async (key: string, value: string) => {
        store.set(key, value);
      },
      get: async (key: string) => store.get(key) ?? null,
      del: async (key: string) => {
        store.delete(key);
      },
      setex: async (key: string, ttl: number, value: string) => {
        store.set(key, value);
      },
      keys: async (pattern: string) => Array.from(store.keys()),
      mget: async (...keys: string[]) => keys.map((key: string) => store.get(key) ?? null),
      pipeline: () => ({
        setex: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        exec: async () => []
      }),
      quit: async () => {}
    }),
    getRedisSubscriber: () => ({
      set: async () => {},
      get: async () => null,
      del: async () => {},
      setex: async () => {},
      keys: async () => [],
      mget: async () => [],
      pipeline: () => ({
        setex: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        exec: async () => []
      }),
      quit: async () => {}
    }),
    closeRedisConnections: async () => {}
  };
});

// Configuración global para limpiar después de los tests
afterAll(async () => {
  // Dar tiempo para que las conexiones se cierren
  await new Promise(resolve => setTimeout(resolve, 100));
});

