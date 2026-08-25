import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { LoggerService } from '../common/services/logger.service';
import { generateId } from '../common/utils/id';

@Injectable()
export class StoryStorageService {
  private readonly storage = new Storage();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(StoryStorageService.name);
  }

  async uploadStoryImage(
    locationId: string,
    bytes: Buffer,
    mimeType: string,
  ): Promise<string> {
    const bucketName = this.requireBucket();
    if (!bytes.length) {
      throw new BadRequestException('Generated image was empty');
    }

    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg')
      ? 'jpg'
      : mimeType.includes('webp')
        ? 'webp'
        : 'png';
    const objectPath = `locations/${locationId}/stories/${generateId()}.${extension}`;
    const bucket = this.storage.bucket(bucketName);
    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      contentType: mimeType || 'image/png',
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
  }

  async deleteIfManaged(imageUrl: string | null | undefined): Promise<void> {
    const parsed = this.parseManagedObject(imageUrl);
    if (!parsed) return;

    try {
      await this.storage
        .bucket(parsed.bucket)
        .file(parsed.objectPath)
        .delete({ ignoreNotFound: true });
    } catch (error) {
      this.logger.warn(
        `Unable to delete story image from storage: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private requireBucket(): string {
    const bucket = this.configService.get<string>('GCS_MENU_BUCKET')?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'Story image storage is not configured (GCS_MENU_BUCKET)',
      );
    }
    return bucket;
  }

  private parseManagedObject(
    imageUrl: string | null | undefined,
  ): { bucket: string; objectPath: string } | null {
    if (!imageUrl) return null;

    const bucket = this.configService.get<string>('GCS_MENU_BUCKET')?.trim();
    if (!bucket) return null;

    try {
      const url = new URL(imageUrl);
      const host = url.hostname;
      let objectPath = '';

      if (host === 'storage.googleapis.com') {
        const parts = url.pathname.replace(/^\/+/, '').split('/');
        if (parts[0] !== bucket) return null;
        objectPath = parts.slice(1).join('/');
      } else if (host === `${bucket}.storage.googleapis.com`) {
        objectPath = url.pathname.replace(/^\/+/, '');
      } else {
        return null;
      }

      if (!objectPath.startsWith(`locations/`)) return null;
      return { bucket, objectPath };
    } catch {
      return null;
    }
  }
}
