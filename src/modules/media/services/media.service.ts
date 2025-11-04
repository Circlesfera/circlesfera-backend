import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';

import { env } from '@config/index.js';
import { getS3Client } from '@infra/storage/s3/client.js';
import { logger } from '@infra/logger/logger.js';
import { ApplicationError } from '@core/errors/application-error.js';

export interface MediaUploadResult {
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
  ): Promise<MediaUploadResult> {
    // Validar tipo real del archivo usando magic bytes (más seguro que MIME type)
    const fileType = await fileTypeFromBuffer(file);
    if (!fileType) {
      throw new ApplicationError('No se pudo determinar el tipo de archivo', {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Validar que el tipo real coincida con el MIME type reportado
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    const allowedFileTypes = [
      { mime: 'image/jpeg', ext: 'jpg' },
      { mime: 'image/png', ext: 'png' },
      { mime: 'image/webp', ext: 'webp' },
      { mime: 'image/gif', ext: 'gif' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/webm', ext: 'webm' }
    ];

    const validType = allowedFileTypes.find(t => t.mime === fileType.mime);
    if (!validType) {
      throw new ApplicationError('Tipo de archivo no permitido', {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Verificar que el MIME type reportado coincida con el tipo real
    if (fileType.mime !== mimeType) {
      logger.warn(
        { reportedMime: mimeType, actualMime: fileType.mime },
        'MIME type reportado no coincide con tipo real del archivo'
      );
      // Usar el tipo real detectado
      mimeType = fileType.mime;
    }

    const mediaId = randomUUID();
    const extension = validType.ext;
    const key = `media/${userId}/${mediaId}.${extension}`;
    const kind = this.getMediaKind(fileType.mime);

    const s3Client = getS3Client();

    // Subir archivo original
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET_MEDIA,
          Key: key,
          Body: file,
          ContentType: mimeType
        })
      );
    } catch (error) {
      const err = error as Error & { code?: string; syscall?: string };
      // Detectar errores de conexión a servicios externos
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.syscall === 'getaddrinfo') {
        throw new ApplicationError('El servicio de almacenamiento no está disponible', {
          statusCode: 503,
          code: 'STORAGE_SERVICE_UNAVAILABLE',
          cause: error
        });
      }
      // Re-lanzar otros errores
      throw error;
    }

    const url = `${env.S3_ENDPOINT}/${env.S3_BUCKET_MEDIA}/${key}`;

    let result: MediaUploadResult = {
      url,
      thumbnailUrl: url
    };

    // Procesar según el tipo
    if (kind === 'image') {
      const imageData = await this.processImage(file);
      result = { ...result, ...imageData, thumbnailUrl: url }; // Para imágenes, thumbnail = url
    } else if (kind === 'video') {
      const videoData = await this.processVideo(file, userId, mediaId, s3Client);
      result = { ...result, ...videoData };
    }

    return result;
  }

  private async processImage(file: Buffer): Promise<Pick<MediaUploadResult, 'width' | 'height'>> {
    try {
      const image = sharp(file);
      const metadata = await image.metadata();

      return {
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      logger.warn({ error }, 'Error al procesar imagen');
      return { width: undefined, height: undefined };
    }
  }

  private async processVideo(
    file: Buffer,
    userId: string,
    mediaId: string,
    s3Client: ReturnType<typeof getS3Client>
  ): Promise<Pick<MediaUploadResult, 'thumbnailUrl' | 'durationMs' | 'width' | 'height'>> {
    const tempDir = tmpdir();
    const videoPath = join(tempDir, `${mediaId}.mp4`);
    const thumbnailPath = join(tempDir, `${mediaId}_thumb.jpg`);

    try {
      // Escribir video temporal
      await writeFile(videoPath, file);

      // Usar promisify para convertir callbacks en promises
      const getVideoMetadata = (): Promise<{ duration?: number; width?: number; height?: number }> => {
        return new Promise((resolve, reject) => {
          ffmpeg.ffprobe(videoPath, (err: Error | null, metadata: any) => {
            if (err) {
              reject(err);
              return;
            }

            const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
            resolve({
              duration: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : undefined,
              width: videoStream?.width,
              height: videoStream?.height
            });
          });
        });
      };

      const generateThumbnail = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .screenshots({
              timestamps: ['00:00:01'],
              filename: `${mediaId}_thumb.jpg`,
              folder: tempDir,
              size: '640x640'
            })
            .on('end', () => {
              resolve();
            })
            .on('error', (err: Error) => {
              reject(err);
            });
        });
      };

      // Primero obtener metadata, luego generar thumbnail
      const metadata = await getVideoMetadata();
      await generateThumbnail();

      // Leer thumbnail generado y optimizarlo con sharp
      let thumbnailBuffer: Buffer;
      try {
        thumbnailBuffer = await sharp(thumbnailPath).jpeg({ quality: 80 }).resize(640, 640, { fit: 'inside', withoutEnlargement: true }).toBuffer();
      } catch (error) {
        // Si sharp falla, leer el archivo directamente
        thumbnailBuffer = await readFile(thumbnailPath);
      }
      const thumbnailKey = `media/${userId}/${mediaId}_thumb.jpg`;

      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET_MEDIA,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg'
          })
        );
      } catch (error) {
        const err = error as Error & { code?: string; syscall?: string };
        // Detectar errores de conexión a servicios externos
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.syscall === 'getaddrinfo') {
          logger.warn({ err: error }, 'Error al subir thumbnail a almacenamiento');
          // Continuar sin thumbnail en lugar de fallar completamente
        } else {
          throw error;
        }
      }

      const thumbnailUrl = `${env.S3_ENDPOINT}/${env.S3_BUCKET_MEDIA}/${thumbnailKey}`;

      // Limpiar archivos temporales
      await Promise.all([unlink(videoPath).catch(() => {}), unlink(thumbnailPath).catch(() => {})]);

      return {
        thumbnailUrl,
        durationMs: metadata.duration,
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      logger.warn({ error }, 'Error al procesar video');
      // Limpiar archivos temporales en caso de error
      await Promise.all([unlink(videoPath).catch(() => {}), unlink(thumbnailPath).catch(() => {})]);
      return {
        thumbnailUrl: '', // Fallback
        durationMs: undefined,
        width: undefined,
        height: undefined
      };
    }
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

