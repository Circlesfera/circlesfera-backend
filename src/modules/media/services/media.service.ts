import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

import { env } from '@config/index.js';
import { getS3Client } from '@infra/storage/s3/client.js';

export interface MediaUploadResult {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

export class MediaService {
  public async uploadMedia(
    file: Buffer,
    mimeType: string,
    userId: string
  ): Promise<Pick<MediaUploadResult, 'url' | 'thumbnailUrl'>> {
    const mediaId = randomUUID();
    const extension = this.getExtensionFromMimeType(mimeType);
    const key = `media/${userId}/${mediaId}.${extension}`;

    const s3Client = getS3Client();

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_MEDIA,
        Key: key,
        Body: file,
        ContentType: mimeType
      })
    );

    // TODO: Generar thumbnail para videos y extraer dimensiones
    // TODO: Calcular duración para videos

    const url = `${env.S3_ENDPOINT}/${env.S3_BUCKET_MEDIA}/${key}`;

    return {
      url,
      thumbnailUrl: url // Temporal, hasta implementar thumbnails
    };
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm'
    };

    return extensions[mimeType] ?? 'bin';
  }

  public getMediaKind(mimeType: string): 'image' | 'video' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }
    if (mimeType.startsWith('video/')) {
      return 'video';
    }
    throw new Error(`Tipo de media no soportado: ${mimeType}`);
  }
}

