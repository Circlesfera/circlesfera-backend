import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

import { env } from '@config/index.js';

let s3Client: S3Client | null = null;

const createConfig = (): S3ClientConfig => ({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY
  },
  forcePathStyle: env.S3_ENDPOINT.includes('localhost') || env.S3_ENDPOINT.includes('127.0.0.1')
});

/**
 * Instancia singleton del cliente S3. Soporta AWS S3 y alternativas compatibles (MinIO).
 */
export const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client(createConfig());
  }

  return s3Client;
};

