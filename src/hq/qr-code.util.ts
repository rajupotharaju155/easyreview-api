import { customAlphabet } from 'nanoid';
import {
  QR_CODE_ALPHABET,
  QR_CODE_LENGTH,
  PUBLIC_SITE_BASE_URL,
} from './hq.constants';

const generateQrNanoId = customAlphabet(QR_CODE_ALPHABET, QR_CODE_LENGTH);

export function generateQrCodeValue(): string {
  return generateQrNanoId();
}

/** Canonical rating URL encoded into assigned claimable QR redirects. */
export function ratingPageTargetUrl(slug: string): string {
  return `${PUBLIC_SITE_BASE_URL}/rate/${encodeURIComponent(slug.trim())}`;
}

/** Canonical public menu URL encoded into assigned Menu QR redirects. */
export function menuPageTargetUrl(slug: string): string {
  return `${PUBLIC_SITE_BASE_URL}/menu/${encodeURIComponent(slug.trim())}`;
}
