import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { LoggerService } from '../common/services/logger.service';
import { generateId } from '../common/utils/id';

export type ProfileImageFile = {
  buffer: Buffer;
  size: number;
  mimetype?: string;
};

export type ProfileImageKind = 'cover' | 'avatar';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Uploads for EasyProfile cards. Uses a dedicated bucket
 * (`GCS_PROFILE_BUCKET`) so profile images live apart from EasyMenu
 * and QR-product assets.
 */
@Injectable()
export class ProfileStorageService {
  private readonly storage = new Storage();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(ProfileStorageService.name);
  }

  async uploadImage(
    profileId: string,
    kind: ProfileImageKind,
    file: ProfileImageFile,
  ): Promise<string> {
    const bucketName = this.requireBucket();
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a photo to upload');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        'Photo is too large. Please use a smaller image.',
      );
    }
    if (file.mimetype && !ALLOWED_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Upload a JPEG, PNG, WebP, or GIF photo');
    }

    const extension = this.extensionFromMime(file.mimetype) ?? 'jpg';
    // A per-upload id keeps the URL fingerprinted so CDNs / cached scans
    // pick up a new image without needing cache-busting query params.
    const objectPath = `profiles/${profileId}/${kind}/${generateId()}.${extension}`;
    const bucket = this.storage.bucket(bucketName);
    await bucket.file(objectPath).save(file.buffer, {
      resumable: false,
      contentType: file.mimetype ?? 'image/jpeg',
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
        `Unable to delete profile image from storage: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private requireBucket(): string {
    const bucket = this.configService.get<string>('GCS_PROFILE_BUCKET')?.trim();
    if (!bucket) {
      throw new ServiceUnavailableException(
        'Profile image storage is not configured (GCS_PROFILE_BUCKET)',
      );
    }
    return bucket;
  }

  private extensionFromMime(mimetype?: string): string | null {
    if (!mimetype) return null;
    if (mimetype === 'image/jpg') return 'jpg';
    if (mimetype === 'image/jpeg') return 'jpg';
    if (mimetype === 'image/png') return 'png';
    if (mimetype === 'image/webp') return 'webp';
    if (mimetype === 'image/gif') return 'gif';
    return null;
  }

  private parseManagedObject(
    imageUrl: string | null | undefined,
  ): { bucket: string; objectPath: string } | null {
    if (!imageUrl || imageUrl.startsWith('data:')) return null;

    const bucket = this.configService.get<string>('GCS_PROFILE_BUCKET')?.trim();
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

      if (!objectPath.startsWith('profiles/')) return null;
      return { bucket, objectPath };
    } catch {
      return null;
    }
  }
}
