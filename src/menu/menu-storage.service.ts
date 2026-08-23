import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { LoggerService } from '../common/services/logger.service';
import { generateId } from '../common/utils/id';

export type MenuImageFile = {
  buffer: Buffer;
  size: number;
  mimetype?: string;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class MenuStorageService {
  private readonly storage = new Storage();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(MenuStorageService.name);
  }

  async uploadItemImage(
    locationId: string,
    file: MenuImageFile,
  ): Promise<string> {
    const bucketName = this.requireBucket();
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a photo to upload');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Photo is too large. Please use a smaller image.');
    }
    if (file.mimetype && !ALLOWED_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Upload a JPEG, PNG, WebP, or GIF photo');
    }

    const objectPath = `locations/${locationId}/items/${generateId()}.jpg`;
    const bucket = this.storage.bucket(bucketName);
    await bucket.file(objectPath).save(file.buffer, {
      resumable: false,
      contentType: 'image/jpeg',
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
        `Unable to delete menu photo from storage: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private requireBucket(): string {
    const bucket = this.configService.get<string>('GCS_MENU_BUCKET')?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'Menu photo storage is not configured (GCS_MENU_BUCKET)',
      );
    }
    return bucket;
  }

  private parseManagedObject(
    imageUrl: string | null | undefined,
  ): { bucket: string; objectPath: string } | null {
    if (!imageUrl || imageUrl.startsWith('data:')) return null;

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
