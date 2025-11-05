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
    // Extraer el tipo MIME base del reportado (sin parámetros como codecs)
    const baseReportedMime = mimeType.toLowerCase().split(';')[0].trim();
    
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/heic',
      'image/heif',
      'video/mp4',
      'video/mp4v-es',
      'video/x-m4v',
      'video/webm',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/x-matroska', // .mkv
      'video/3gpp', // .3gp
      'video/x-ms-wmv', // .wmv
      'video/mpeg', // .mpeg, .mpg
      'video/ogg', // .ogv
      'video/x-ms-asf', // .asf
      'video/x-flv' // .flv
    ];
    const allowedFileTypes = [
      { mime: 'image/jpeg', ext: 'jpg' },
      { mime: 'image/jpg', ext: 'jpg' },
      { mime: 'image/png', ext: 'png' },
      { mime: 'image/webp', ext: 'webp' },
      { mime: 'image/gif', ext: 'gif' },
      { mime: 'image/bmp', ext: 'bmp' },
      { mime: 'image/heic', ext: 'heic' },
      { mime: 'image/heif', ext: 'heif' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/mp4v-es', ext: 'mp4' },
      { mime: 'video/x-m4v', ext: 'm4v' },
      { mime: 'video/webm', ext: 'webm' },
      { mime: 'video/quicktime', ext: 'mov' },
      { mime: 'video/x-msvideo', ext: 'avi' },
      { mime: 'video/x-matroska', ext: 'mkv' },
      { mime: 'video/3gpp', ext: '3gp' },
      { mime: 'video/x-ms-wmv', ext: 'wmv' },
      { mime: 'video/mpeg', ext: 'mpg' },
      { mime: 'video/ogg', ext: 'ogv' },
      { mime: 'video/x-ms-asf', ext: 'asf' },
      { mime: 'video/x-flv', ext: 'flv' }
    ];

    // Validar que el MIME type reportado esté permitido
    if (!allowedMimes.includes(baseReportedMime)) {
      const errorMessage = `Tipo de archivo no permitido. Tipo recibido: ${mimeType} (base: ${baseReportedMime}). Tipos permitidos: imágenes (JPEG, PNG, WebP, GIF) o videos (MP4, WebM, MOV, etc.)`;
      throw new ApplicationError(errorMessage, {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
        metadata: {
          reportedMimeType: mimeType,
          baseReportedMime
        }
      });
    }

    // Intentar detectar el tipo real del archivo usando magic bytes
    const fileType = await fileTypeFromBuffer(file);
    
    if (fileType) {
      // Si se detectó el tipo, verificar que sea válido
      const validDetectedType = allowedFileTypes.find(t => t.mime === fileType.mime);
      
      if (!validDetectedType) {
        // Si el tipo detectado no es válido pero el reportado sí, aceptar con advertencia
        logger.warn(
          { detectedMime: fileType.mime, reportedMime: baseReportedMime },
          'Tipo detectado no está en la lista permitida, pero el reportado sí. Aceptando basado en MIME type reportado.'
        );
      } else {
        // Si ambos son válidos pero diferentes, usar el detectado y advertir
        if (fileType.mime !== baseReportedMime) {
          logger.warn(
            { reportedMime: baseReportedMime, detectedMime: fileType.mime },
            'MIME type reportado no coincide con tipo detectado. Usando tipo detectado.'
          );
          mimeType = fileType.mime;
        } else {
          // Coinciden, usar el detectado para mayor seguridad
          mimeType = fileType.mime;
        }
      }
    } else {
      // Si no se pudo detectar el tipo, confiar en el MIME type reportado (ya validado)
      logger.warn(
        { reportedMime: baseReportedMime },
        'No se pudo detectar el tipo de archivo usando magic bytes. Confiando en MIME type reportado.'
      );
    }

    // Obtener el tipo válido y la extensión basado en el mimeType final
    const validType = allowedFileTypes.find(t => t.mime === mimeType);
    if (!validType) {
      // Si no encontramos el tipo, usar el método de fallback
      const extension = this.getExtensionFromMimeType(mimeType);
      throw new ApplicationError(`Tipo de archivo no soportado: ${mimeType}`, {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE'
      });
    }

    const mediaId = randomUUID();
    const extension = validType.ext;
    const key = `media/${userId}/${mediaId}.${extension}`;
    const kind = this.getMediaKind(mimeType);

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
      const err = error as Error & { 
        code?: string; 
        syscall?: string;
        $metadata?: { httpStatusCode?: number };
        Code?: string;
        name?: string;
        message?: string;
      };
      
      // Detectar errores de conexión a servicios externos
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.syscall === 'getaddrinfo') {
        throw new ApplicationError('El servicio de almacenamiento no está disponible. Verifica que MinIO esté corriendo.', {
          statusCode: 503,
          code: 'STORAGE_SERVICE_UNAVAILABLE',
          cause: error
        });
      }
      
      // Detectar errores específicos de S3/MinIO
      if (err.$metadata?.httpStatusCode === 403 || err.Code === 'InvalidAccessKeyId' || err.name === 'InvalidAccessKeyId') {
        throw new ApplicationError('Credenciales de almacenamiento inválidas. Verifica S3_ACCESS_KEY y S3_SECRET_KEY en tu archivo .env', {
          statusCode: 503,
          code: 'STORAGE_AUTH_ERROR',
          cause: error
        });
      }
      
      if (err.Code === 'NoSuchBucket' || err.name === 'NoSuchBucket') {
        throw new ApplicationError(`El bucket "${env.S3_BUCKET_MEDIA}" no existe. Verifica S3_BUCKET_MEDIA en tu archivo .env`, {
          statusCode: 503,
          code: 'STORAGE_BUCKET_NOT_FOUND',
          cause: error
        });
      }
      
      if (err.$metadata?.httpStatusCode === 403) {
        throw new ApplicationError('Acceso denegado al almacenamiento. Verifica las credenciales y permisos de MinIO.', {
          statusCode: 503,
          code: 'STORAGE_ACCESS_DENIED',
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
        const err = error as Error & { 
          code?: string; 
          syscall?: string;
          $metadata?: { httpStatusCode?: number };
          Code?: string;
          name?: string;
        };
        // Detectar errores de conexión a servicios externos
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.syscall === 'getaddrinfo') {
          logger.warn({ err: error }, 'Error al subir thumbnail a almacenamiento');
          // Continuar sin thumbnail en lugar de fallar completamente
        } else if (err.$metadata?.httpStatusCode === 403 || err.Code === 'InvalidAccessKeyId' || err.name === 'InvalidAccessKeyId') {
          // Si hay error de autenticación, lanzar error para que se propague
          throw new ApplicationError('Credenciales de almacenamiento inválidas. Verifica S3_ACCESS_KEY y S3_SECRET_KEY en tu archivo .env', {
            statusCode: 503,
            code: 'STORAGE_AUTH_ERROR',
            cause: error
          });
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
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'video/mp4': 'mp4',
      'video/mp4v-es': 'mp4',
      'video/x-m4v': 'm4v',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/x-matroska': 'mkv',
      'video/3gpp': '3gp',
      'video/x-ms-wmv': 'wmv',
      'video/mpeg': 'mpg',
      'video/ogg': 'ogv',
      'video/x-ms-asf': 'asf',
      'video/x-flv': 'flv'
    };

    return extensions[mimeType.toLowerCase()] ?? 'bin';
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

