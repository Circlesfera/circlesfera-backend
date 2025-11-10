import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { ApplicationError } from '@core/errors/application-error.js';
import { MediaService } from '@modules/media/services/media.service.js';

import { FrameService, type FrameFeedItem } from './frame.service.js';
import { createFrameSchema } from '../dtos/create-frame.dto.js';
import { logger } from '@infra/logger/logger.js';

export class FrameUploadService {
  public constructor(
    private readonly frameService = new FrameService(),
    private readonly mediaService = new MediaService()
  ) {}

  public async createFromUpload(userId: string, file: Express.Multer.File, caption: string): Promise<FrameFeedItem> {
    const fileBuffer = await readFile(file.path);
    const uploadResult = await this.mediaService.uploadMedia(fileBuffer, file.mimetype, userId);
    const duration = uploadResult.durationMs ?? 0;

    if (duration <= 0) {
      throw new ApplicationError('No se pudo determinar la duración del video subido', {
        statusCode: 400,
        code: 'FRAME_INVALID_DURATION'
      });
    }

    if (duration > 60_000) {
      throw new ApplicationError('El video supera los 60 segundos permitidos para un frame', {
        statusCode: 400,
        code: 'FRAME_DURATION_EXCEEDED'
      });
    }

    const payload = createFrameSchema.parse({
      caption,
      media: [
        {
          id: randomUUID(),
          kind: 'video' as const,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          durationMs: duration,
          width: uploadResult.width,
          height: uploadResult.height,
          rotation: uploadResult.rotation
        }
      ]
    });

    try {
      return await this.frameService.createFrame(userId, payload);
    } finally {
      await unlink(file.path).catch((err) => {
        logger.warn({ err, path: file.path }, 'No se pudo eliminar archivo temporal de frame');
      });
    }
  }
}
