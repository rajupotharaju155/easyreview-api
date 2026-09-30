import { customAlphabet } from 'nanoid';
import { QR_CODE_ALPHABET, QR_CODE_LENGTH } from '../hq/hq.constants';

const generateProfileNanoId = customAlphabet(QR_CODE_ALPHABET, QR_CODE_LENGTH);
const PROFILE_CODE_PATTERN = new RegExp(
  `^[${QR_CODE_ALPHABET}]{${QR_CODE_LENGTH}}$`,
);

/** Short code stored on a profile and encoded into its QR / NFC URL. */
export function generateProfileCodeValue(): string {
  return generateProfileNanoId();
}

export function isProfileCode(value: string): boolean {
  return PROFILE_CODE_PATTERN.test(value);
}
