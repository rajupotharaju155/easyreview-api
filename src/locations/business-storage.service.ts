import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { generateId } from '../common/utils/id';

export type BusinessLogoFile = {
  buffer: Buffer;
  size: number;
  mimetype?: string;
};

export const BUSINESS_LOGO_MAX_BYTES = 2 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

/**
 * Public business assets, such as the logo, shared by all products.
 * Stored in `GCS_BUSINESS_BUCKET` under `locations/{locationId}/`.
 * Replaced logos are kept because issued invoices still point at the
 * logo they were issued with. Nothing private belongs in this bucket.
 */
@Injectable()
export class BusinessStorageService {
  private readonly storage = new Storage();

  constructor(private readonly configService: ConfigService) {}

  async uploadLogo(
    locationId: string,
    file: BusinessLogoFile,
  ): Promise<string> {
    const bucketName = this.requireBucket();
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a logo to upload');
    }
    if (file.size > BUSINESS_LOGO_MAX_BYTES) {
      throw new BadRequestException(
        'Logo is too large. Use an image under 2 MB.',
      );
    }
    const extension = file.mimetype ? EXTENSION_BY_TYPE[file.mimetype] : null;
    if (!extension) {
      throw new BadRequestException('Upload a PNG, JPEG or WebP logo');
    }

    // A per-upload id keeps the URL unique, so it can be cached forever.
    const objectPath = `locations/${locationId}/logo/${generateId()}.${extension}`;
    await this.storage
      .bucket(bucketName)
      .file(objectPath)
      .save(file.buffer, {
        resumable: false,
        contentType: file.mimetype,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });

    return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
  }

  private requireBucket(): string {
    const bucket = this.configService
      .get<string>('GCS_BUSINESS_BUCKET')
      ?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'Logo storage is not configured (GCS_BUSINESS_BUCKET)',
      );
    }
    return bucket;
  }
}
